import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

Config.setVideoImageFormat("jpeg");
Config.setTimeoutInMilliseconds(60000);
Config.setCodec("h264");
Config.setPublicDir("video/public");
Config.overrideWebpackConfig((config) => enableTailwind(config));
