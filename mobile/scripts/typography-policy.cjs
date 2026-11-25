const path = require('node:path');

// Enforce the shared typography at the compilation boundary of our UI.
// Do not transform third-party icon fonts, SDKs, native modules or the policy itself.
module.exports = function typographyPolicy({ types: t }) {
  return {
    name: 'caliskan-b2b-typography-policy',
    visitor: {
      Program(program, state) {
        const root = path.resolve(state.opts.root || path.join(__dirname, '..'));
        const filename = state.file.opts.filename;
        if (!filename) return;
        const relative = path.relative(root, filename).split(path.sep).join('/');
        if (!/^(app|components|contexts|hooks|lib)\//.test(relative) ||
            relative === 'components/ui/AppTypography.tsx' ||
            !/\.[jt]sx?$/.test(relative)) return;
        const target = path.join(root, 'components/ui/AppTypography');
        let source = path.relative(path.dirname(filename), target).split(path.sep).join('/');
        if (!source.startsWith('.')) source = './' + source;
        const imports = [];
        const animatedNames = new Set();
        const namespaceNames = new Set();
        for (const declaration of program.get('body')) {
          if (!declaration.isImportDeclaration() || declaration.node.source.value !== 'react-native' ||
              declaration.node.importKind === 'type') continue;
          const retain = [];
          const redirect = [];
          for (const spec of declaration.node.specifiers) {
            if (t.isImportNamespaceSpecifier(spec) || t.isImportDefaultSpecifier(spec)) {
              namespaceNames.add(spec.local.name);
            }
            if (t.isImportSpecifier(spec) && spec.importKind !== 'type') {
              const name = spec.imported.name || spec.imported.value;
              if (name === 'Animated') animatedNames.add(spec.local.name);
              if (name === 'Text' || name === 'TextInput') {
                redirect.push(t.importSpecifier(t.identifier(spec.local.name), t.identifier(name)));
                continue;
              }
            }
            retain.push(spec);
          }
          if (redirect.length) {
            imports.push(t.importDeclaration(redirect, t.stringLiteral(source)));
            if (retain.length) declaration.node.specifiers = retain;
            else declaration.remove();
          }
        }
        const aliases = new Map();
        const alias = name => {
          if (!aliases.has(name)) aliases.set(name, program.scope.generateUidIdentifier('Policy' + name));
          return aliases.get(name);
        };
        // Handle RN.Text / RN.TextInput / Animated.Text in JSX and expressions.
        const memberName = node => {
          if (!(t.isMemberExpression(node) || t.isJSXMemberExpression(node))) return null;
          if (node.computed && !t.isStringLiteral(node.property)) return null;
          const prop = node.property.name || node.property.value;
          const object = node.object;
          const name = object.name;
          if (namespaceNames.has(name) && (prop === 'Text' || prop === 'TextInput')) return prop;
          if (prop === 'Text' && animatedNames.has(name)) return 'AnimatedText';
          if (prop === 'Text' && (t.isMemberExpression(object) || t.isJSXMemberExpression(object)) &&
            namespaceNames.has(object.object.name) && (object.property.name || object.property.value) === 'Animated') return 'AnimatedText';
          return null;
        };
        program.traverse({
          JSXMemberExpression(p) {
            const name = memberName(p.node);
            if (name) p.replaceWith(t.jsxIdentifier(alias(name).name));
          },
          MemberExpression(p) {
            const name = memberName(p.node);
            if (name) p.replaceWith(t.cloneNode(alias(name)));
          },
          CallExpression(p) {
            // New direct CommonJS UI imports would evade the policy. Use ES imports instead.
            if (t.isIdentifier(p.node.callee,{name:'require'}) &&
                t.isStringLiteral(p.node.arguments[0],{value:'react-native'})) {
              const parent = p.parentPath;
              if (parent.isVariableDeclarator() && t.isObjectPattern(parent.node.id) &&
                  parent.node.id.properties.every(prop => t.isObjectProperty(prop) &&
                    t.isIdentifier(prop.key) && !['Text','TextInput','Animated'].includes(prop.key.name))) return;
              // appAlert.ts has a type assertion around its Alert-only fallback.
              if (relative === 'lib/appAlert.ts') return;
              throw p.buildCodeFrameError('Çalışkan B2B: use ES imports for React Native UI; typography policy is mandatory.');
            }
          },
        });
        if (aliases.size) imports.push(t.importDeclaration(
          Array.from(aliases, ([name, local]) => t.importSpecifier(local, t.identifier(name))),
          t.stringLiteral(source)));
        if (imports.length) {
          program.unshiftContainer('body', imports);
          program.scope.crawl();
        }
      },
    },
  };
};
