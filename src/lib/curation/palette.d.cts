declare const palette: {
  LectaPalette: {
    fromPixels(data: Uint8Array): unknown[];
    pack(swatches: unknown[]): { hex: string; weight: number }[];
  };
};
export = palette;
