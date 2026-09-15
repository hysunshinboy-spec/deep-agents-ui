"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StandaloneConfig } from "@/lib/config";
import { LanguageToggle } from "@/app/components/LanguageToggle";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { useI18n } from "@/providers/I18nProvider";
import { toast } from "sonner";

interface ConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: StandaloneConfig) => void;
  initialConfig?: StandaloneConfig;
}

/**
 * Renders a translated string that marks code spans with backticks, so the
 * hint keeps its monospace file names in every language.
 */
function renderHint(text: string) {
  return text
    .split("`")
    .map((part, index) =>
      index % 2 === 1 ? <code key={index}>{part}</code> : part
    );
}

export function ConfigDialog({
  open,
  onOpenChange,
  onSave,
  initialConfig,
}: ConfigDialogProps) {
  const { t } = useI18n();
  const [deploymentUrl, setDeploymentUrl] = useState(
    initialConfig?.deploymentUrl || ""
  );
  const [assistantId, setAssistantId] = useState(
    initialConfig?.assistantId || ""
  );
  const [langsmithApiKey, setLangsmithApiKey] = useState(
    initialConfig?.langsmithApiKey || ""
  );

  useEffect(() => {
    if (open && initialConfig) {
      setDeploymentUrl(initialConfig.deploymentUrl);
      setAssistantId(initialConfig.assistantId);
      setLangsmithApiKey(initialConfig.langsmithApiKey || "");
    }
  }, [open, initialConfig]);

  const handleSave = () => {
    if (!deploymentUrl || !assistantId) {
      toast.error(t("config.required"));
      return;
    }

    onSave({
      deploymentUrl,
      assistantId,
      langsmithApiKey: langsmithApiKey || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{t("config.title")}</DialogTitle>
          <DialogDescription>{t("config.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="deploymentUrl">{t("config.deploymentUrl")}</Label>
            <Input
              id="deploymentUrl"
              placeholder="http://127.0.0.1:2024"
              value={deploymentUrl}
              onChange={(e) => setDeploymentUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assistantId">{t("config.assistantId")}</Label>
            <Input
              id="assistantId"
              placeholder="research_agent"
              value={assistantId}
              onChange={(e) => setAssistantId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {renderHint(t("config.assistantIdHint"))}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="langsmithApiKey">
              {t("config.apiKey")}{" "}
              <span className="text-muted-foreground">
                {t("config.optional")}
              </span>
            </Label>
            <Input
              id="langsmithApiKey"
              type="password"
              placeholder="lsv2_pt_..."
              value={langsmithApiKey}
              onChange={(e) => setLangsmithApiKey(e.target.value)}
            />
          </div>
        </div>
        {/* 语言与主题即时生效，不参与下面的保存按钮。
            两个控件的根节点都是 <button>，而 globals.css 里的 `button { border: none }`
            把 border-style 也一并置成了 none（Tailwind 的 `border` 只给宽度不给样式），
            按钮上因此画不出边框；border-solid 把样式补回来，border-input 让边框色
            和上面的输入框一致（否则 `border: none` 会把它重置成 currentColor）。 */}
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <div className="grid gap-2">
            <Label>{t("config.language")}</Label>
            <LanguageToggle className="h-9 w-full justify-start border-solid border-input font-normal" />
          </div>
          <div className="grid gap-2">
            <Label>{t("config.theme")}</Label>
            <ThemeToggle className="h-9 w-full border-solid" />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
