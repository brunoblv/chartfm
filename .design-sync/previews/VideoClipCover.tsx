import { VideoClipCover } from "chartfm";

export const Default = () => <VideoClipCover seed={7} />;

export const Branded = () => (
  <VideoClipCover paletteA="#FA243C" paletteB="#FFE66D" seed={3} width={360} />
);

export const Compact = () => (
  <VideoClipCover paletteA="#7B61FF" paletteB="#00C2FF" seed={12} width={200} />
);
