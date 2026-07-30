import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HeroField from "./hero-field";

describe("hero field reduced motion", () => {
  it("does not create WebGL canvas when reduced motion is requested", () => {
    const { container } = render(<HeroField />);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
  });
});
