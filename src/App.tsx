import { HeroUIProvider } from "@heroui/react";
import { Routes, Route, useNavigate } from "react-router-dom";
// import "./App.css"
import Root from "./routes/Root.tsx";
import Index from "./routes/Index.tsx";


function App() {
  const navigate = useNavigate();

  return (
    <HeroUIProvider navigate={navigate}>
      <Routes>
        <Route path="/" element={<Root />}>
          <Route index element={<Index />} />
          {/* <Route path="gallery" element={<Gallery />} /> */}
          <Route path="about" element={<div>Hello World</div>} />
        </Route>
      </Routes>
    </HeroUIProvider>
  );
}

export default App
