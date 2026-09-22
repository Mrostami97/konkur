import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";

export const SPOTPLAYER_CLIENT = "SPOTPLAYER_CLIENT";

export interface SpotPlayerLicenseRequest {
  /** SpotPlayer course ids this licence covers. */
  courseIds: string[];
  /** Shown in the player as the licence holder. */
  name: string;
  /** Burned into the video. Personal on purpose -- an unwatermarked DRM
   * licence traces back to nobody, which is the whole point of issuing one
   * per person. */
  watermark: string;
}

export interface SpotPlayerLicenseResult {
  licenseId: string;
  key: string;
  /** SpotPlayer returns this relative; the service makes it absolute. */
  url: string;
}

export interface SpotPlayerClient {
  /** False when no API key is configured. Callers check this so they can say
   * "video is not set up" rather than failing with a network error. */
  readonly configured: boolean;
  createLicense(request: SpotPlayerLicenseRequest): Promise<SpotPlayerLicenseResult>;
}

const LICENSE_ENDPOINT = "https://panel.spotplayer.ir/license/edit/";
export const SPOTPLAYER_BASE_URL = "https://panel.spotplayer.ir";

/**
 * Issues licences against SpotPlayer's real API.
 *
 * Contract per https://spotplayer.ir/help/api : POST to the licence endpoint
 * with the key in a `$API` header and `$LEVEL: -1`, body carrying `course`,
 * `name` and `watermark.texts[].text`; the response carries `_id`, `key` and
 * a relative `url`.
 *
 * When no API key is configured this throws rather than returning a
 * plausible-looking fake. A stub that invents a licence key would hand the
 * student a key that does not open anything, and they would only find out
 * after paying -- the same trap the old sandbox payment provider set.
 */
@Injectable()
export class HttpSpotPlayerClient implements SpotPlayerClient {
  private readonly logger = new Logger(HttpSpotPlayerClient.name);
  private readonly apiKey = process.env.SPOTPLAYER_API_KEY?.trim() ?? "";

  get configured(): boolean {
    return this.apiKey.length > 0;
  }

  async createLicense(request: SpotPlayerLicenseRequest): Promise<SpotPlayerLicenseResult> {
    if (!this.configured) {
      throw new ServiceUnavailableException("SpotPlayer is not configured (SPOTPLAYER_API_KEY is unset)");
    }
    if (request.courseIds.length === 0) {
      throw new ServiceUnavailableException("no SpotPlayer course id for this course");
    }

    let response: Response;
    try {
      response = await fetch(LICENSE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          $API: this.apiKey,
          // Their docs say to always send -1.
          $LEVEL: "-1",
        },
        body: JSON.stringify({
          course: request.courseIds,
          name: request.name,
          watermark: { texts: [{ text: request.watermark }] },
        }),
        // A student is waiting on this request; a hung connection should
        // surface as "try again", not as a page that never loads.
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error(`SpotPlayer licence request failed: ${String(error)}`);
      throw new ServiceUnavailableException("could not reach SpotPlayer; try again shortly");
    }

    if (!response.ok) {
      // The body may carry their error message, which is worth logging but
      // not worth returning to the student verbatim.
      const body = await response.text().catch(() => "");
      this.logger.error(`SpotPlayer returned ${response.status}: ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException("SpotPlayer refused the licence request");
    }

    const payload = (await response.json()) as { _id?: unknown; key?: unknown; url?: unknown };
    const licenseId = typeof payload._id === "string" ? payload._id : "";
    const key = typeof payload.key === "string" ? payload.key : "";
    const url = typeof payload.url === "string" ? payload.url : "";
    if (!licenseId || !key || !url) {
      this.logger.error(`SpotPlayer response missing fields: ${JSON.stringify(payload).slice(0, 500)}`);
      throw new ServiceUnavailableException("SpotPlayer returned an unexpected response");
    }

    return { licenseId, key, url };
  }
}
