import { ActionPanel, Action, showToast, Toast, Image, Grid, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import Service, { TextureSearchTexture } from "./service";
import { authorize } from "./oauth";
import TextureDetail from "./texture-detail";

const service = new Service();

interface TextureType {
  type: string;
  name: string;
  imageUrl: string;
  url: string;
}

const textureTypes = [
  {
    name: "Skins",
    type: "SKIN",
    imageUrl: `https://skin.laby.net/api/render/skin/%s.png?shadow=true&height=300&width=250`,
    url: `https://laby.net/skin/%s`,
  },
  {
    name: "Capes",
    type: "CAPE",
    imageUrl: `https://skin.laby.net/api/render/cape/%s.png?shadow=true&height=300&width=250`,
    url: `https://laby.net/cape/%s`,
  },
];

export default function Command() {
  const [type, setType] = useState<TextureType>(textureTypes[0]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TextureSearchTexture[]>([]);
  const [isLoading, setLoading] = useState(true);

  const search = async () => {
    setLoading(true);

    return await service
      .searchTextures(type.type, query)
      .then((res) => {
        setResults(res.textures);
      })
      .catch((err) => {
        showToast(Toast.Style.Failure, "Error searching textures", err.message);
        setResults([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    (async () => {
      await search();
    })();
  }, [query, type]);

  return (
    <Grid
      isLoading={isLoading}
      throttle={true}
      aspectRatio={"3/4"}
      columns={6}
      searchBarPlaceholder="Search for tags"
      onSearchTextChange={async (query) => setQuery(query.trim())}
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Select type"
          onChange={(type) => setType(textureTypes.filter((t) => t.type === type)[0])}
        >
          {textureTypes.map((type) => (
            <Grid.Dropdown.Item value={type.type} title={type.name} key={type.type} />
          ))}
        </Grid.Dropdown>
      }
    >
      {results.map((entry) => {
        return (
          <Grid.Item
            content={{
              source: type.imageUrl.replace("%s", entry.imageHash),
              mask: Image.Mask.RoundedRectangle,
            }}
            key={entry.imageHash}
            title={entry.name === undefined ? entry.useCount.toLocaleString() + " Users" : entry.name}
            subtitle={entry.name === undefined ? "" : entry.useCount.toLocaleString() + " Users"}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Show Details"
                  icon={Icon.Eye}
                  target={<TextureDetail imageHash={entry.imageHash} type={type.type as "SKIN" | "CAPE"} />}
                />
                <Action.OpenInBrowser url={type.url.replace("%s", entry.imageHash)} />
                <Action
                  title="Add to Library"
                  icon={Icon.Plus}
                  shortcut={{ modifiers: ["cmd"], key: "l" }}
                  onAction={async () => {
                    try {
                      await authorize();
                      const meta = await service.getTextureMeta(entry.imageHash, type.type);
                      if (!meta) {
                        await showToast(Toast.Style.Failure, "Texture not found");
                        return;
                      }
                      await service.addToLibrary(meta.id);
                      await showToast(Toast.Style.Success, "Added to library", meta.name ?? undefined);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "Unknown error";
                      await showToast(Toast.Style.Failure, "Failed to add to library", message);
                    }
                  }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </Grid>
  );
}
