# Laby.net Changelog

## [OAuth & Texture Library] - {PR_MERGE_DATE}

- Added Laby.net OAuth login (PKCE) — the access token is automatically attached to all API requests when signed in
- Added new "Manage Texture Library" command to view and remove skins and capes from your personal library
- Added "Add to Library" action to the "Search Textures" command
- Added texture detail page with name, description, and similar textures (via difference hash)

## [Maintenance] - 2026-03-16

- Update axios to ^0.30.3 to address CVE for denial of service via `__proto__` key in `mergeConfig`

## [API Adjustments] - 2024-10-14
- Adjust models to match the latest API changes
- Add icon and link to profile badges

## [Upgrade to v3 API] - 2023-12-19

- Update laby.net api to v3
- Remove accountType property which was removed from api
- Fix AxiosError: Request failed with status code 504

## [Initial Version] - 2022-12-06

- Added initial version of profile search & page
- Added basic texture search (skins & capes)
