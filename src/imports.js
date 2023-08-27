"use strict";

const shared = require("./shared");

const defaultGroups = [
  // Side effect imports.
  ["^\\u0000"],
  // Node.js builtins prefixed with `node:`.
  ["^node:"],
  // Packages.
  // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
  ["^@?\\w"],
  // Absolute imports and other imports such as Vue-style `@/foo`.
  // Anything not matched in another group.
  ["^"],
  // Relative imports.
  // Anything that starts with a dot.
  ["^\\."],
];

module.exports = {
  meta: {
    type: "layout",
    fixable: "code",
    schema: [
      {
        type: "any",
        additionalProperties: true,
      },
    ],
    docs: {
      url: "https://github.com/lydell/eslint-plugin-simple-import-sort#sort-order",
    },
    messages: {
      sort: "Run autofix to sort these imports!",
    },
  },
  create: (context) => {
    const { matchers, order } = context.options[0] || {};

    const parents = new Set();

    return {
      ImportDeclaration: (node) => {
        parents.add(node.parent);
      },

      "Program:exit": () => {
        for (const parent of parents) {
          for (const chunk of shared.extractChunks(parent, (node) =>
            isImport(node) ? "PartOfChunk" : "NotPartOfChunk"
          )) {
            maybeReportChunkSorting(chunk, context, matchers, order);
          }
        }
        parents.clear();
      },
    };
  },
};

function maybeReportChunkSorting(chunk, context, matchers, order) {
  const sourceCode = context.getSourceCode();
  const items = shared.getImportExportItems(
    chunk,
    sourceCode,
    isSideEffectImport,
    getSpecifiers
  );
  const sortedItems = makeSortedItems(items, matchers, order);
  const sorted = shared.printSortedItems(sortedItems, items, sourceCode);
  const { start } = items[0];
  const { end } = items[items.length - 1];
  shared.maybeReportSorting(context, sorted, start, end);
}

function makeSortedItems(items, matchers, order) {
  const itemGroups = matchers.map(({ fn, name }) =>
    ({ fn, name, items: [] })
  );

  for (const item of items) {
    const { originalSource } = item.source;

    const source = item.isSideEffectImport
      ? `\0${originalSource}`
      : item.source.kind !== "value"
      ? `${originalSource}\0`
      : originalSource;

    for (const { fn, items: groupItems } of itemGroups) {
      const isMatch = fn(source)

      if (isMatch) {
        groupItems.push(item)
        break
      }
    }
  }

  itemGroups.sort(({ name: a }, { name: b }) => order.indexOf(a) - order.indexOf(b))

  return itemGroups
    .filter(({ items: f }) => f.length > 0)
    .map(({ items: f }) => shared.sortImportExportItems(f));
}

// Exclude "ImportDefaultSpecifier" – the "def" in `import def, {a, b}`.
function getSpecifiers(importNode) {
  return importNode.specifiers.filter((node) => isImportSpecifier(node));
}

// Full import statement.
function isImport(node) {
  return node.type === "ImportDeclaration";
}

// import def, { a, b as c, type d } from "A"
//               ^  ^^^^^^  ^^^^^^
function isImportSpecifier(node) {
  return node.type === "ImportSpecifier";
}

// import "setup"
// But not: import {} from "setup"
// And not: import type {} from "setup"
function isSideEffectImport(importNode, sourceCode) {
  return (
    importNode.specifiers.length === 0 &&
    (!importNode.importKind || importNode.importKind === "value") &&
    !shared.isPunctuator(sourceCode.getFirstToken(importNode, { skip: 1 }), "{")
  );
}
