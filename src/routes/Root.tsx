import {
  Navbar, NavbarBrand, NavbarContent, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Spacer, Link, Divider
} from "@heroui/react";
import { TbHome, TbNotebook } from "react-icons/tb";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { MapToken, MapTokenContext, MapType } from "../contexts/MapToken";
import atogakiIcon from "../../atogaki.png";
// import gradLeft from '../assets/gradients/left.png';
// import gradRight from '../assets/gradients/right.png';

const routes = [
  { route: '/', text: '主页', icon: <TbHome size={22}/> },
  { route: '/blog', text: '後書き', icon: <TbNotebook size={22}/> },
];
type MapboxTokenResponse = {
  token: string;
};
export default function Root() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [token, setToken] = useState<MapToken>()
  const navigate = useNavigate();
  const location = useLocation();
  const isBlogRoute = location.pathname.startsWith('/blog');

  useEffect(() => {
      // mapbox
      axios.get<MapboxTokenResponse>('https://api.bokufa.art/api/mapbox/token').then((res) => {
        setToken({ type: MapType.MapBox, token: res.data.token })
      })
  }, [])


  return (
    <MapTokenContext.Provider value={{ token, setToken }}>
      <main className="relative min-h-dvh text-foreground scrollbar-hide">
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
        <div className="relative z-10">
        <Navbar
          onMenuOpenChange={setIsMenuOpen}
          isMenuOpen={isMenuOpen}
          className={`border-b transition-colors duration-700 ease-out ${
            isBlogRoute
              ? 'border-black/5 bg-[rgba(255,255,255,0.55)] text-[#382920] shadow-sm backdrop-blur-md'
              : 'border-transparent bg-white text-foreground shadow-none'
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
          <div className="relative z-10 max-w-64 hidden md:flex flex-col sticky top-[5rem] h-[100%] flex-shrink-0">
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
