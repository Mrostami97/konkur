/**
 * Terms students type in English (or in another common spelling) for what the
 * site writes in Persian. Each group is one meaning; a query using any member
 * also searches with the others. Kept to unambiguous computer-science terms.
 */
const GROUPS: string[][] = [
  ["dijkstra", "دایکسترا", "دیکسترا", "کوتاه‌ترین مسیر"],
  ["bellman-ford", "bellman", "بلمن", "بلمن-فورد"],
  ["heap", "هیپ", "هرم"],
  ["stack", "پشته"],
  ["queue", "صف"],
  ["hash", "hashing", "درهم‌سازی", "هش"],
  ["graph", "گراف"],
  ["tree", "درخت"],
  ["bst", "درخت دودویی جست‌وجو"],
  ["avl", "درخت avl"],
  ["sort", "sorting", "مرتب‌سازی"],
  ["quicksort", "مرتب‌سازی سریع"],
  ["mergesort", "مرتب‌سازی ادغامی"],
  ["dfs", "جست‌وجوی عمق‌اول"],
  ["bfs", "جست‌وجوی سطح‌اول"],
  ["mst", "درخت پوشای کمینه"],
  ["dynamic programming", "dp", "برنامه‌ریزی پویا"],
  ["greedy", "حریصانه"],
  ["recursion", "بازگشت", "بازگشتی"],
  ["recurrence", "رابطهٔ بازگشتی", "روابط بازگشتی"],
  ["master theorem", "قضیهٔ اصلی"],
  ["complexity", "پیچیدگی"],
  ["np", "np-کامل", "انپی"],
  ["automata", "automaton", "ماشین", "اتوماتا"],
  ["dfa", "nfa", "ماشین متناهی"],
  ["regular", "منظم"],
  ["pda", "ماشین پشته‌ای"],
  ["turing", "تورینگ"],
  ["grammar", "گرامر"],
  ["pumping lemma", "لم تزریق"],
  ["database", "databases", "sql", "پایگاه داده"],
  ["normalization", "نرمال‌سازی"],
  ["operating system", "os", "سیستم عامل"],
  ["deadlock", "بن‌بست"],
  ["scheduling", "زمان‌بندی"],
  ["paging", "صفحه‌بندی"],
  ["network", "networks", "شبکه"],
  ["tcp", "udp", "لایهٔ انتقال"],
  ["cache", "حافظهٔ نهان", "کش"],
  ["pipeline", "خط لوله"],
  ["architecture", "معماری"],
  ["logic", "digital logic", "مدار منطقی", "مدارهای منطقی"],
  ["ai", "هوش مصنوعی"],
  ["probability", "احتمال"],
  ["statistics", "آمار"],
  ["discrete", "گسسته"],
  ["linear algebra", "جبر خطی"],
  ["english", "زبان"],
  ["rank", "رتبه"],
];

/** The query with each known term swapped for its other names: the query itself first. */
export function searchVariants(normalizedQuery: string, normalize: (value: string) => string): string[] {
  const variants = new Set([normalizedQuery]);
  for (const group of GROUPS) {
    const names = group.map(normalize);
    const hit = names.find((name) => ` ${normalizedQuery} `.includes(` ${name} `));
    if (!hit) continue;
    for (const name of names) if (name !== hit) variants.add(` ${normalizedQuery} `.replace(` ${hit} `, ` ${name} `).trim());
  }
  return [...variants].slice(0, 12);
}
