import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Viewer from "@/pages/viewer";
import PatientManager from "@/pages/patient-manager";
import OHIFPrototypeGemini from "@/pages/ohif-prototype";
import FusionTest from "@/pages/fusion-test";
import PrototypeModule from "@/pages/prototype-module";
import SuperStyle from "@/pages/superstyle";
import SeriesPreview from "@/pages/series-preview";

function Router() {
  return (
    <Switch>
      <Route path="/" component={PatientManager} />
      <Route path="/viewer" component={Viewer} />
      <Route path="/enhanced-viewer" component={Viewer} />
      <Route path="/preview" component={SeriesPreview} />
      <Route path="/fusion-test" component={FusionTest} />
      <Route path="/ohif-prototype" component={OHIFPrototypeGemini} />
      <Route path="/prototype-module" component={PrototypeModule} />
      <Route path="/prototypes" component={PrototypeModule} />
      <Route path="/superstyle" component={SuperStyle} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
