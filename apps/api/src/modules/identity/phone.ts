/** The ten digits after the leading 9 identify a mobile number, whichever
 * prefix it was typed with. */
export function mobileTail(phone: string): string | null {
  const match = /9[0-9]{9}$/.exec(phone.replace(/[^0-9]/g, ""));
  return match ? match[0] : null;
}

/** Every way the same mobile number may already be stored. */
export function phoneVariants(phone: string): string[] {
  const tail = mobileTail(phone);
  return tail ? [`0${tail}`, `+98${tail}`, `98${tail}`, `0098${tail}`, tail] : [phone];
}
