import type * as React from "react";
import type { SvgProps } from "react-native-svg";

declare module "*.svg" {
  const content: React.FC<SvgProps>;
}