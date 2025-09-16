import {
  Navbar, NavbarBrand, NavbarContent, NavbarMenu, NavbarMenuItem, NavbarMenuToggle, Spacer, Link, Divider
} from "@heroui/react";
import { TbHome } from "react-icons/tb";
import { Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { MapToken, MapTokenContext, MapType } from "../contexts/MapToken";
// import gradLeft from '../assets/gradients/left.png';
// import gradRight from '../assets/gradients/right.png';

const routes = [
  { route: '/', text: '主页', icon: <TbHome size={22}/> },
];

export default function Root() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<MapToken>()
  const navigate = useNavigate();

  useEffect(() => {
      // mapbox
      axios.get<Response<string>>('https://api.bokufa.art/api/mapbox/token').then((res) => {
        setToken({ type: MapType.MapBox, token: res.data.token })
      })
  }, [])


  return (
    <MapTokenContext.Provider value={{ token, setToken }}>
      <main className="text-foreground scrollbar-hide">
        <Navbar onMenuOpenChange={setIsMenuOpen} isMenuOpen={isMenuOpen}>
          <NavbarBrand>
            <Link className="font-bold text-inherit text-logo" href='/'>Nihon Saien</Link>
          </NavbarBrand>
          <NavbarContent justify="end">
            <NavbarMenuToggle className="sm:hidden ml-2"/>
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
          <div className="max-w-64 hidden md:flex flex-col sticky top-[5rem] h-[100%] flex-shrink-0">
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
          <div className='min-w-0' style={{ flex: '1 1 auto' }}>
            <Outlet/>
          </div>
        </div>
      </main>
    </MapTokenContext.Provider>
  );
}