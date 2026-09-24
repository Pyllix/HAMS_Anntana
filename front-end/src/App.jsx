import { useState } from "react";
import AppRouter from "./router/AppRouter";
import { QueryClient ,QueryClientProvider } from "@tanstack/react-query"

const queryClient = new QueryClient()

function App() {
  return <AppRouter />;
}

export default App;
