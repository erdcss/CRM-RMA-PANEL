import { registerRootComponent } from "expo";
import { createElement } from "react";
import App from "./App";
import BusinessErrorBoundary from "./components/BusinessErrorBoundary";

function BusinessRoot() {
  return createElement(BusinessErrorBoundary, null, createElement(App));
}

registerRootComponent(BusinessRoot);
