import path from "node:path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
// Garante faixa de áudio AAC no MP4 final
Config.setAudioCodec("aac");
// Windows: evita falha em remotion-audio-mixing no Temp do usuário
Config.setCachingEnabled(false);

// Mesmo alias do tsconfig (`@/*` → raiz do repo)
Config.overrideWebpackConfig((config) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...(config.resolve?.alias ?? {}),
        "@": path.join(process.cwd()),
      },
    },
  };
});
