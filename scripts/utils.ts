import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

export const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

// Split by space, hyphen, underscore, or dot
export const splitWordsBySpaceHyphendUnderscoreOrDot = (str: string): string[] => {
  return str.trim().split(/[-_\s.]+/).filter(w => w.length > 0);
};

export const toPascalCase = (str: string): string => {
  return splitWordsBySpaceHyphendUnderscoreOrDot(str)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
};

export const toCamelCase = (str: string): string => {
  const words = splitWordsBySpaceHyphendUnderscoreOrDot(str);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
};

export const toKebabCase = (str: string): string => {
  return splitWordsBySpaceHyphendUnderscoreOrDot(str)
    .map(word => word.toLowerCase())
    .join('-');
};

export const toSnakeCase = (str: string): string => {
  return splitWordsBySpaceHyphendUnderscoreOrDot(str)
    .map(word => word.toLowerCase())
    .join('_');
};


interface DomainInfo {
  dirName: string;
  className: string;
  absolutePath: string;
}


export const getDomainsServicesWithDomainMap = (): DomainInfo[] => {
  const domainsDir = path.resolve('src/domain');
  if (!fs.existsSync(domainsDir)) return [];

  const domains: DomainInfo[] = [];
  const entries = fs.readdirSync(domainsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Support new structure: src/domain/<name>/services/<file>.ts
      const servicesDir = path.join(domainsDir, entry.name, 'services');
      
      if (fs.existsSync(servicesDir) && fs.statSync(servicesDir).isDirectory()) {
        const files = fs.readdirSync(servicesDir);
        for (const file of files) {
          if (file.endsWith('.ts')) {
             const servicePath = path.join(servicesDir, file);
             const content = fs.readFileSync(servicePath, 'utf8');
             // Regex to find "export class ClassName"
             const match = content.match(/export\s+class\s+(\w+)/);
             if (match && match[1]) {
               domains.push({
                 dirName: entry.name,
                 className: match[1],
                 absolutePath: servicePath
               });
               // Removed the 'break' here to allow listing multiple services per domain
             }
          }
        }
      } else {
        // Fallback/Legacy check: src/domain/<name>/service.ts
        const servicePath = path.join(domainsDir, entry.name, 'service.ts');
        if (fs.existsSync(servicePath)) {
          const content = fs.readFileSync(servicePath, 'utf8');
          const match = content.match(/export\s+class\s+(\w+)/);
          if (match && match[1]) {
            domains.push({
              dirName: entry.name,
              className: match[1],
              absolutePath: servicePath
            });
          }
        }
      }
    }
  }
  return domains;
};