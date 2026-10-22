import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { IoLanguageOutline } from "react-icons/io5";

import { useLanguage } from "../contexts/LanguageContext";
import { isUiLanguage } from "../data/uiMessages";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Button
          isIconOnly
          aria-label={t("language")}
          className="min-w-9 bg-transparent text-inherit"
          radius="full"
          size="sm"
          title={t("language")}
          variant="light"
        >
          <IoLanguageOutline aria-hidden="true" size={20} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        disallowEmptySelection
        aria-label={t("language")}
        className="min-w-32"
        selectedKeys={[language]}
        selectionMode="single"
        onAction={(key) => {
          if (isUiLanguage(key)) setLanguage(key);
        }}
      >
        <DropdownItem key="zh-CN" textValue="中文">
          <span lang="zh-CN">中文</span>
        </DropdownItem>
        <DropdownItem key="ja" textValue="日本語">
          <span lang="ja">日本語</span>
        </DropdownItem>
        <DropdownItem key="en" textValue="English">
          <span lang="en">English</span>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
