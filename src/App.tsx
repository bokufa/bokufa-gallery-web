import { HeroUIProvider } from "@heroui/react";
import { Routes, Route, useNavigate } from "react-router-dom";

// import "./App.css"
import Root from "./routes/Root.tsx";
import Index from "./routes/Index.tsx";
import FilmPage from "./routes/FilmPage.tsx";
import BlogIndex from "./routes/BlogIndex.tsx";
import BlogPost from "./routes/BlogPost.tsx";
import PhotoPage from "./routes/PhotoPage.tsx";
import PrefecturePage from "./routes/PrefecturePage.tsx";
import { HdrProvider } from "./contexts/HdrContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";

function App() {
  return <LanguageProvider><LocalizedApp /></LanguageProvider>;
}

function LocalizedApp() {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <HeroUIProvider navigate={navigate} locale={language}>
      <HdrProvider>
        <Routes>
          <Route element={<Root />} path="/">
            <Route index element={<Index />} />
            <Route element={<FilmPage />} path="film" />
            <Route element={null} path="map" />
            <Route
              element={<PrefecturePage />}
              path="map/prefecture/:prefectureId"
            />
            <Route
              element={<PrefecturePage />}
              path="map/prefecture/:prefectureId/city/:cityId"
            />
            <Route element={<PhotoPage />} path="photo/:id" />
            <Route element={<BlogIndex />} path="blog" />
            <Route element={<BlogPost />} path="blog/:slug" />
            {/* <Route path="gallery" element={<Gallery />} /> */}
            <Route element={<div>Hello World</div>} path="about" />
          </Route>
        </Routes>
      </HdrProvider>
    </HeroUIProvider>
  );
}

export default App;
