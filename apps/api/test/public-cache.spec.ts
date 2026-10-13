import { schedulePublicCacheRefresh, touchesPublicContent } from "../src/modules/audit/public-cache";

describe("public page cache refresh", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("refreshes after changes to articles, guides, imports, sources and authors only", () => {
    for (const action of ["article.approved", "article.updated", "guide.reviewed", "import.published", "content.rolled_back", "content_source.updated", "contributor.updated"]) {
      expect(touchesPublicContent(action)).toBe(true);
    }
    for (const action of ["resource.document_opened", "user.student_role_removed_for_instructor", "exam.published", "order.paid"]) {
      expect(touchesPublicContent(action)).toBe(false);
    }
  });

  it("sends one request for a burst of changes, and none without a web URL", () => {
    jest.useFakeTimers();
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    schedulePublicCacheRefresh(undefined);
    jest.runAllTimers();
    expect(fetchMock).not.toHaveBeenCalled();

    schedulePublicCacheRefresh("http://web:3000/");
    schedulePublicCacheRefresh("http://web:3000/");
    schedulePublicCacheRefresh("http://web:3000/");
    jest.runAllTimers();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://web:3000/internal/revalidate");
  });
});
