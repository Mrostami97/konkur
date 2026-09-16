import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/courses/catalog.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: "catalog.ts",
});
const module = { exports: {} };
vm.runInNewContext(`(function (exports, module) { ${transpiled.outputText}\n})(module.exports, module);`, { module });
const { buildCourseCatalog, findDirectCourseProduct, formatRial } = module.exports;

const publicCourse = { slug: "free-algorithms", title: "رایگان", description: "", accessMode: "PUBLIC" };
const paidCourse = { slug: "paid-theory", title: "پولی", description: "", accessMode: "ENTITLEMENT" };
const products = [
  {
    id: "resource-product",
    slug: "notes-product",
    kind: "RESOURCE",
    title: "جزوه",
    description: "",
    prices: [{ amountRial: 120_000 }],
    courseGrants: [],
    resourceGrants: [{ resource: { slug: "notes" } }],
  },
  {
    id: "bundle-product",
    slug: "bundle-product",
    kind: "BUNDLE",
    title: "بسته",
    description: "",
    prices: [{ amountRial: 900_000 }],
    courseGrants: [{ course: { slug: paidCourse.slug } }],
    resourceGrants: [{ resource: { slug: "notes" } }],
  },
  {
    id: "course-product",
    slug: "product-slug-is-different",
    kind: "COURSE",
    title: paidCourse.title,
    description: "",
    prices: [{ amountRial: 490_000 }],
    courseGrants: [{ course: { slug: paidCourse.slug } }],
    resourceGrants: [],
  },
];

const catalog = buildCourseCatalog([publicCourse, paidCourse], products);
assert.equal(catalog.length, 2, "the catalog must be driven by published courses, not arbitrary products");
assert.equal(catalog[0].href, "/courses/free-algorithms", "a public course without a product must remain visible");
assert.equal(catalog[0].priceLabel, "رایگان");
assert.equal(catalog[0].product, null);
assert.equal(catalog[1].href, "/courses/paid-theory", "course routes must use the granted course slug");
assert.equal(catalog[1].product.id, "course-product");
assert.equal(catalog[1].priceLabel, formatRial(490_000));
assert.match(catalog[1].priceLabel, /ریال$/);
assert.doesNotMatch(catalog[1].priceLabel, /تومان/);
assert.equal(findDirectCourseProduct(products, paidCourse.slug).id, "course-product", "RESOURCE and BUNDLE products must not masquerade as course products");
assert.ok(catalog.every((item) => !item.href.includes("product")), "product slugs must not become course detail routes");

const unavailableProductsCatalog = buildCourseCatalog([paidCourse], [], true);
assert.equal(
  unavailableProductsCatalog[0].priceLabel,
  "قیمت موقتاً در دسترس نیست",
  "an API outage must not be presented as an unpublished product",
);

const legacyCourse = { slug: "legacy-paid", title: "قدیمی", description: "" };
const legacyProduct = {
  ...products[2],
  id: "legacy-product",
  courseGrants: [{ course: { slug: legacyCourse.slug } }],
};
const legacyCatalog = buildCourseCatalog([legacyCourse], [legacyProduct]);
assert.equal(legacyCatalog[0].accessLabel, "دورهٔ تخصصی", "missing legacy accessMode must remain entitlement-gated");
assert.equal(legacyCatalog[0].product.id, "legacy-product");

console.log("Phase 18 course catalog tests passed.");
