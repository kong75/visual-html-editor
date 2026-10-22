import { parse } from '@babel/parser';

/** Remove exports of omitted modules without depending on line breaks or names. */
export function registryIndex(source, excludedModules) {
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  let exports = source;
  for (const statement of [...ast.program.body].reverse()) {
    if ((statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportAllDeclaration')
      && statement.source && excludedModules.has(statement.source.value)) {
      exports = exports.slice(0, statement.start) + exports.slice(statement.end);
    }
  }
  return `import './styles.css';\n\n${exports.replaceAll('\r\n', '\n').trimStart()}`;
}
