declare module "@tabler/icons-react/dist/esm/icons/IconDice5.mjs" {
  import type {
    ForwardRefExoticComponent,
    RefAttributes,
    SVGProps,
  } from "react";

  type DiceIconProps = Omit<SVGProps<SVGSVGElement>, "size" | "stroke"> & {
    size?: number | string;
    stroke?: number | string;
  };

  const IconDice5: ForwardRefExoticComponent<
    DiceIconProps & RefAttributes<SVGSVGElement>
  >;

  export default IconDice5;
}
