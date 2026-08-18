declare module "react-helmet" {
  import type { FC, ReactNode } from "react";

  export interface HelmetProps {
    children?: ReactNode;
  }

  export const Helmet: FC<HelmetProps>;
}
