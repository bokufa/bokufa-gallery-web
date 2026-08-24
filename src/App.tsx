import { HeroUIProvider } from "@heroui/react";
import { Routes, Route, useNavigate } from "react-router-dom";
// import "./App.css"
import Root from "./routes/Root.tsx";
import Index from "./routes/Index.tsx";
import BlogIndex from "./routes/BlogIndex.tsx";
import BlogPost from "./routes/BlogPost.tsx";
import PhotoPage from "./routes/PhotoPage.tsx";
import PrefecturePage from "./routes/PrefecturePage.tsx";


function App() {
  const navigate = useNavigate();

  return (
    <HeroUIProvider navigate={navigate}>
      <Routes>
        <Route path="/" element={<Root />}>
          <Route index element={<Index />} />
          <Route path="map" element={null} />
          <Route path="map/prefecture/:prefectureId" element={<PrefecturePage />} />
          <Route path="map/prefecture/:prefectureId/city/:cityId" element={<PrefecturePage />} />
          <Route path="photo/:id" element={<PhotoPage />} />
          <Route path="blog" element={<BlogIndex />} />
          <Route path="blog/:slug" element={<BlogPost />} />
          {/* <Route path="gallery" element={<Gallery />} /> */}
          <Route path="about" element={<div>Hello World</div>} />
        </Route>
      </Routes>
    </HeroUIProvider>
  );
}

export default App
