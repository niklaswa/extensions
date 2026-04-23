import { ActionPanel, Action, List, Icon, showToast, Toast, useNavigation, Image } from "@raycast/api";
import { useEffect, useState } from "react";
import Service, { TextureMeta, TextureSearchTexture } from "./service";
import { authorize } from "./oauth";

const service = new Service();

export interface TextureDetailProps {
  imageHash: string;
  type: "SKIN" | "CAPE";
}

interface TextureTypeConfig {
  thumbUrl: string;
  renderUrl: string;
  url: string;
}

const typeConfigs: Record<"SKIN" | "CAPE", TextureTypeConfig> = {
  SKIN: {
    thumbUrl: "https://skin.laby.net/api/render/skin/%s.png?shadow=true&height=64&width=64",
    renderUrl: "https://skin.laby.net/api/render/skin/%s.png?shadow=true&height=480&width=320",
    url: "https://laby.net/skin/%s",
  },
  CAPE: {
    thumbUrl: "https://skin.laby.net/api/render/cape/%s.png?shadow=true&height=64&width=64",
    renderUrl: "https://skin.laby.net/api/render/cape/%s.png?shadow=true&height=480&width=320",
    url: "https://laby.net/cape/%s",
  },
};

export default function TextureDetail({ imageHash, type }: TextureDetailProps) {
  const config = typeConfigs[type];
  const [meta, setMeta] = useState<TextureMeta | null>(null);
  const [similar, setSimilar] = useState<TextureSearchTexture[]>([]);
  const [isLoading, setLoading] = useState(true);
  const { push } = useNavigation();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const textureMeta = await service.getTextureMeta(imageHash, type);
        setMeta(textureMeta);

        if (textureMeta?.differenceHash) {
          const result = await service.searchTextures(type, `dhash:${textureMeta.differenceHash}`, 10);
          setSimilar(result.textures.filter((t) => t.imageHash !== imageHash));
        } else {
          setSimilar([]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await showToast(Toast.Style.Failure, "Failed to load texture", message);
      } finally {
        setLoading(false);
      }
    })();
  }, [imageHash, type]);

  const description = meta?.description?.en ?? null;

  const mainMarkdown = `![](${config.renderUrl.replace("%s", imageHash)})\n\n${description ?? ""}`;

  return (
    <List isLoading={isLoading} isShowingDetail navigationTitle={meta?.name ?? "Texture"}>
      <List.Section title={type === "SKIN" ? "Skin" : "Cape"}>
        <List.Item
          title={meta?.name ?? "Texture"}
          icon={{
            source: config.thumbUrl.replace("%s", imageHash),
            mask: Image.Mask.RoundedRectangle,
          }}
          detail={
            <List.Item.Detail
              markdown={mainMarkdown}
              metadata={
                meta ? (
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Name" text={meta.name} />
                    <List.Item.Detail.Metadata.Label title="ID" text={String(meta.id)} />
                    <List.Item.Detail.Metadata.Label title="Image Hash" text={imageHash} />
                    {meta.differenceHash ? (
                      <List.Item.Detail.Metadata.Label title="Difference Hash" text={meta.differenceHash} />
                    ) : null}
                  </List.Item.Detail.Metadata>
                ) : undefined
              }
            />
          }
          actions={
            <ActionPanel>
              <Action.OpenInBrowser url={config.url.replace("%s", imageHash)} />
              {meta ? (
                <Action
                  title="Add to Library"
                  icon={Icon.Plus}
                  shortcut={{ modifiers: ["cmd"], key: "l" }}
                  onAction={async () => {
                    try {
                      await authorize();
                      await service.addToLibrary(meta.id);
                      await showToast(Toast.Style.Success, "Added to library", meta.name);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Unknown error";
                      await showToast(Toast.Style.Failure, "Failed to add to library", message);
                    }
                  }}
                />
              ) : null}
              <Action.CopyToClipboard title="Copy Image Hash" content={imageHash} />
            </ActionPanel>
          }
        />
      </List.Section>
      {similar.length > 0 ? (
        <List.Section title="Similar" subtitle={`${similar.length}`}>
          {similar.map((s) => (
            <List.Item
              key={s.imageHash}
              title={`${s.useCount.toLocaleString()} Users`}
              subtitle={s.name ?? s.tags ?? ""}
              icon={{
                source: config.thumbUrl.replace("%s", s.imageHash),
                mask: Image.Mask.RoundedRectangle,
              }}
              detail={
                <List.Item.Detail
                  markdown={`![](${config.renderUrl.replace("%s", s.imageHash)})`}
                  metadata={
                    <List.Item.Detail.Metadata>
                      {s.name ? <List.Item.Detail.Metadata.Label title="Name" text={s.name} /> : null}
                      <List.Item.Detail.Metadata.Label title="Image Hash" text={s.imageHash} />
                      <List.Item.Detail.Metadata.Label title="Users" text={s.useCount.toLocaleString()} />
                      {s.tags ? <List.Item.Detail.Metadata.Label title="Tags" text={s.tags} /> : null}
                    </List.Item.Detail.Metadata>
                  }
                />
              }
              actions={
                <ActionPanel>
                  <Action
                    title="Show Details"
                    icon={Icon.Eye}
                    onAction={() => push(<TextureDetail imageHash={s.imageHash} type={type} />)}
                  />
                  <Action.OpenInBrowser url={config.url.replace("%s", s.imageHash)} />
                  <Action.CopyToClipboard title="Copy Image Hash" content={s.imageHash} />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}
