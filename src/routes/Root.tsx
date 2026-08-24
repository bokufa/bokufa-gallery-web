import {
  Navbar, NavbarBrand, NavbarContent, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Spacer, Link, Divider
} from "@heroui/react";
import { TbHome, TbMap, TbNotebook } from "react-icons/tb";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MapToken, MapTokenContext, MapType } from "../contexts/MapToken";
import atogakiIcon from "../../atogaki.png";
import { fetchMapboxToken } from "../services/map";
import MapPage from "./MapPage";
// import gradLeft from '../assets/gradients/left.png';
// import gradRight from '../assets/gradients/right.png';

const routes = [
  { route: '/', text: '主页', icon: <TbHome size={22}/> },
  { route: '/map', text: '地图', icon: <TbMap size={22}/> },
  { route: '/blog', text: '後書き', icon: <TbNotebook size={22}/> },
];
export default function Root() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [token, setToken] = useState<MapToken>()
  const navigate = useNavigate();
  const location = useLocation();
  const isBlogRoute = location.pathname.startsWith('/blog');
  const isMapRoute = location.pathname === '/map';
  const isMapSection = location.pathname === '/map' || location.pathname.startsWith('/map/');

  useEffect(() => {
    const controller = new AbortController();
    fetchMapboxToken(controller.signal)
      .then((mapboxToken) => {
        setToken({ type: MapType.MapBox, token: mapboxToken });
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [])


  return (
    <MapTokenContext.Provider value={{ token, setToken }}>
      <main className="relative min-h-dvh text-foreground scrollbar-hide">
        <MapPage isActive={isMapSection} overlayActive={isMapSection && !isMapRoute} />
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-0 transition-opacity duration-700 ease-out ${
            isBlogRoute ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background:
              'linear-gradient(rgba(255, 250, 238, 0.08), rgba(255, 250, 238, 0.08)), url("https://sp.yorushika.com/static/yorushika/fanclub/pc_introduce/bg_table.jpg") center / 625px 405px repeat',
          }}
        />
        <div
          aria-hidden="true"
          className={`atogaki-paper-texture pointer-events-none absolute inset-y-0 left-1/2 z-0 -ml-2 w-[calc(100%+16px)] max-w-[1040px] -translate-x-1/2 transition-opacity duration-700 ease-out ${
            isBlogRoute ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className={`relative z-10 ${isMapRoute ? 'pointer-events-none' : ''}`}>
        <Navbar
          onMenuOpenChange={setIsMenuOpen}
          isMenuOpen={isMenuOpen}
          className={`pointer-events-auto border-b border-black/5 shadow-sm transition-[background-color,backdrop-filter] duration-700 ease-out ${
            isMapSection
              ? 'map-glass-panel'
              : 'bg-[rgba(255,255,255,0.55)] backdrop-blur-md'
          } ${
            isBlogRoute ? 'text-[#382920]' : 'text-foreground'
          }`}
        >
          <NavbarBrand>
            <Link className="site-brand-title text-inherit" href='/'>Nihon Saien</Link>
          </NavbarBrand>
          <NavbarContent justify="end">
            {isBlogRoute ? (
              <Link
                aria-label="後書き"
                className="text-inherit"
                onPress={() => navigate('/blog')}
              >
                <img
                  src={atogakiIcon}
                  alt="後書き"
                  draggable={false}
                  className="h-9 w-auto object-contain md:h-11"
                />
              </Link>
            ) : null}
            <NavbarMenuToggle
              className={`sm:hidden ml-2 ${isBlogRoute ? 'text-[#382920]' : 'text-foreground'}`}
            />
          </NavbarContent>
          <NavbarMenu>
            {routes.map((r) => (
              <NavbarMenuItem key={r.route}>
                <Link
                  className="w-full pt-3 font-bold"
                  size="lg"
                  onPress={() => {
                    navigate(r.route)
                    setIsMenuOpen(false)
                  }}
                  color='foreground'
                >
                  {r.icon}
                  <Spacer x={2}/>
                  {r.text}
                </Link>
              </NavbarMenuItem>
            ))}
            <Divider className='mt-4 mb-4'/>
            <div className='text-tiny text-default-400'>
              <p>© {new Date().getFullYear()} Bokufa's Gallery. All rights reserved.</p>
            </div>
          </NavbarMenu>
        </Navbar>
        <div
          className="mx-auto max-w-[1024px] flex"
          style={{ minHeight: 'calc(100dvh - 4rem)' }}
        >
          <div className={`relative z-30 max-w-64 hidden md:flex flex-col sticky top-[5rem] h-[100%] flex-shrink-0 pb-6 transition-[background-color,box-shadow,backdrop-filter] ${
            isMapSection ? 'map-glass-panel pointer-events-auto rounded-large shadow-medium' : ''
          }`}>
            <ul>
              {routes.map((r) => (
                <li key={r.route}>
                  <Link
                    href={r.route}
                    className="px-4 py-3 block"
                    color="foreground"
                    onPress={() => navigate(r.route)}
                  >
                    <span className="text-medium font-bold flex items-center">
                      {r.icon}
                      <Spacer x={2}/>
                      {r.text}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Divider className='mt-4 mb-4'/>
            <div className='text-tiny text-default-300 px-4'>
              <p>© {new Date().getFullYear()} Bokufa's Gallery. All rights reserved.</p>
            </div>
          </div>
          <div className='relative z-10 min-w-0' style={{ flex: '1 1 auto' }}>
            <Outlet/>
          </div>
        </div>
        </div>
      </main>
    </MapTokenContext.Provider>
  );
}
