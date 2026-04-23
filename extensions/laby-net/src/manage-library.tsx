import { ActionPanel, Action, Grid, Icon, showToast, Toast, confirmAlert, Alert } from "@raycast/api";
import { useEffect, useState } from "react";
import Service, { TextureLibraryTexture } from "./service";
import { authorize, logout } from "./oauth";
import TextureDetail from "./texture-detail";

const service = new Service();

interface LibraryType {
  type: string;
  name: string;
  imageUrl: string;
  url: string;
}

const libraryTypes: LibraryType[] = [
  {
    name: "Skins",
    type: "SKIN",
    imageUrl: "https://skin.laby.net/api/render/skin/%s.png?shadow=true&height=300&width=250",
    url: "https://laby.net/skin/%s",
  },
  {
    name: "Capes",
    type: "CAPE",
    imageUrl: "https://skin.laby.net/api/render/cape/%s.png?shadow=true&height=300&width=250",
    url: "https://laby.net/cape/%s",
  },
];

export default function Command() {
  const [type, setType] = useState<LibraryType>(libraryTypes[0]);
  const [items, setItems] = useState<TextureLibraryTexture[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = async (forType: LibraryType) => {
    setLoading(true);
    try {
      await authorize();
      const library = await service.getLibrary(forType.type);
      setItems(library);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast(Toast.Style.Failure, "Failed to load library", message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(type);
  }, [type]);

  const handleRemove = async (texture: TextureLibraryTexture) => {
    const confirmed = await confirmAlert({
      title: "Remove from Library",
      message: "Are you sure you want to remove this texture from your library?",
      primaryAction: { title: "Remove", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;

    try {
      await service.removeFromLibrary(texture.id);
      setItems((current) => current.filter((t) => t.id !== texture.id));
      await showToast(Toast.Style.Success, "Removed from library");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await showToast(Toast.Style.Failure, "Failed to remove texture", message);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirmAlert({
      title: "Log Out",
      message: "Are you sure you want to log out of Laby.net?",
      primaryAction: { title: "Log Out", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    await logout();
    setItems([]);
    await showToast(Toast.Style.Success, "Logged out");
  };

  return (
    <Grid
      isLoading={isLoading}
      aspectRatio={"3/4"}
      columns={6}
      searchBarPlaceholder="Filter library"
      searchBarAccessory={
        <Grid.Dropdown
          tooltip="Select type"
          onChange={(value) => {
            const next = libraryTypes.find((t) => t.type === value);
            if (next) setType(next);
          }}
        >
          {libraryTypes.map((t) => (
            <Grid.Dropdown.Item value={t.type} title={t.name} key={t.type} />
          ))}
        </Grid.Dropdown>
      }
    >
      {!isLoading && items.length === 0 ? (
        <Grid.EmptyView
          icon={Icon.Folder}
          title={`No ${type.name.toLowerCase()} in your library`}
          description="Add textures from the Search Textures command."
        />
      ) : null}
      {items.map((texture) => (
        <Grid.Item
          key={texture.id}
          content={{
            source: type.imageUrl.replace("%s", texture.imageHash),
          }}
          title={`${texture.useCount.toLocaleString()} Users`}
          actions={
            <ActionPanel>
              <Action.Push
                title="Show Details"
                icon={Icon.Eye}
                target={<TextureDetail imageHash={texture.imageHash} type={type.type as "SKIN" | "CAPE"} />}
              />
              <Action.OpenInBrowser url={type.url.replace("%s", texture.imageHash)} />
              <Action
                title="Remove from Library"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["ctrl"], key: "x" }}
                onAction={() => handleRemove(texture)}
              />
              <Action
                title="Reload"
                icon={Icon.ArrowClockwise}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() => load(type)}
              />
              <Action
                title="Log Out"
                icon={Icon.Logout}
                shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
                onAction={handleLogout}
              />
            </ActionPanel>
          }
        />
      ))}
    </Grid>
  );
}
