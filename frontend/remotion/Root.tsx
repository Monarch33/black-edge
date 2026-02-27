import React from "react";
import { Composition } from "remotion";
import { BlackEdgeAd } from "./BlackEdgeAd";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="BlackEdgeAd"
      component={BlackEdgeAd}
      durationInFrames={450}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
