import * as path from 'path';

/**
 * Normalizes a path to an absolute path for consistency in VFS lookups.
 */
export const abs = (p: string) => path.resolve(p);

/**
 * Creates a Virtual File System state and mock implementations for fs methods.
 */
export class MockFileSystem {
  public virtualFileSystem: Record<string, string> = {};
  public trackedRenames: Record<string, string> = {};
  public trackedDeletions: string[] = [];
  public trackedDirs: string[] = [];

  constructor(initialState: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialState)) {
      this.virtualFileSystem[abs(key)] = value;
    }
  }

  // --- Helper to check if a path implies a directory exists ---
  private isDirectory(p: string): boolean {
    // Explicit directory entry
    if (this.virtualFileSystem[p] === 'DIRECTORY') return true;
    
    // Implicit directory (has children)
    const prefix = p + path.sep;
    return Object.keys(this.virtualFileSystem).some(k => k.startsWith(prefix));
  }

  // --- Mock Implementations ---

  existsSync = (filePath: string): boolean => {
    const p = abs(filePath);
    return !!this.virtualFileSystem[p] || this.isDirectory(p);
  };

  readFileSync = (filePath: string, _encoding?: any): string => {
    const content = this.virtualFileSystem[abs(filePath)];
    if (content === undefined) throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    return content;
  };

  writeFileSync = (filePath: string, content: string) => {
    this.virtualFileSystem[abs(filePath)] = content;
  };

  mkdirSync = (dirPath: string, _options?: any) => {
    const p = abs(dirPath);
    this.virtualFileSystem[p] = 'DIRECTORY';
    this.trackedDirs.push(p);
  };

  renameSync = (oldPath: string, newPath: string) => {
    const oldAbs = abs(oldPath);
    const newAbs = abs(newPath);
    
    this.trackedRenames[oldAbs] = newAbs;

    const keys = Object.keys(this.virtualFileSystem);
    for (const key of keys) {
      if (key === oldAbs) {
        this.virtualFileSystem[newAbs] = this.virtualFileSystem[oldAbs];
        delete this.virtualFileSystem[oldAbs];
      } else if (key.startsWith(oldAbs + path.sep)) {
        const suffix = key.slice(oldAbs.length);
        const newKey = newAbs + suffix;
        this.virtualFileSystem[newKey] = this.virtualFileSystem[key];
        delete this.virtualFileSystem[key];
      }
    }
  };

  unlinkSync = (filePath: string) => {
    const p = abs(filePath);
    if (!this.virtualFileSystem[p]) throw new Error(`ENOENT: ${filePath}`);
    delete this.virtualFileSystem[p];
    this.trackedDeletions.push(p);
  };

  readdirSync = (dirPath: string, options?: { withFileTypes?: boolean }): any[] => {
    const p = abs(dirPath);
    const files = new Set<string>();
    
    Object.keys(this.virtualFileSystem).forEach(key => {
      if (key.startsWith(p + path.sep)) {
        const relative = key.slice(p.length + 1);
        const topLevel = relative.split(path.sep)[0];
        files.add(topLevel);
      }
    });

    const result = Array.from(files);

    if (options?.withFileTypes) {
      return result.map(name => ({
        name,
        isDirectory: () => this.isDirectory(path.join(p, name))
      }));
    }
    return result;
  };

  statSync = (filePath: string) => ({
    isDirectory: () => this.isDirectory(abs(filePath))
  });
}