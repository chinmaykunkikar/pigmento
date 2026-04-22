export type Category = "icon" | "illustration" | "photo" | "other";

export type ScannedFile = {
  absPath: string;
  relPath: string;
  dir: string;
  name: string;
  stem: string;
  ext: string;
  size: number;
  mtime: number;
};
