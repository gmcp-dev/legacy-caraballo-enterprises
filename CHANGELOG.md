# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.2.0](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.13...v1.2.0) (2026-07-19)


### Features

* update currency formatting to use en-US locale across multiple components ([5e25614](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/5e25614aa8d718fe4b535dba79adfe50acc4c704))


### Bug Fixes

* correct treasury transaction type from 'salida' to 'entrada' ([7f023d9](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/7f023d9d73a7b4232f83d69adc0e85c77764ac6b))

### [1.1.13](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.12...v1.1.13) (2026-07-19)


### Features

* add BancoPage and ClientDetail routes to App component ([31869e3](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/31869e3fa95675bea7e93437dface5f8c7dfd3f3))
* add BancoPage component with initial layout and functionality ([90a19ec](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/90a19ec38cc5e1ad4725f9c083b88f0e512ad3f1))
* add bank routes to API for enhanced functionality ([5cf699b](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/5cf699b716fa05bfc6a0519b3f085e0add795aff))
* add BankReceipt component with layout, styling, and download functionality ([e8d1d37](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/e8d1d379fcc88bb832a4a4ba04f6a0818e4de252))
* add ClientDetail and FarmDetail components with styling and functionality improvements ([9f3732f](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/9f3732fbb18b173bc07410c4961c0b46bf9184e9))
* add icon for banco-maze project in Sidebar component ([fc219c7](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/fc219c715a957119f4aa0328262633f093f74191))
* add projects module with project data and utility functions ([471adb1](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/471adb1f8ed7941c8050a5f4eb663f83afcadc95))
* enhance farm routes with debt management and product inventory initialization ([e1b4d80](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/e1b4d80233dad2ced92a536f7649527536108b9a))
* enhance member routes to include project details in member data ([53a9aec](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/53a9aec369ed140697e7fc1dca4995549bf7849e))
* implement bank routes for clients, loans, payments, and stats ([f81fd28](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/f81fd28bb6ff54b4cef5991fa7905fa709d6ec7f))
* update database schema to remove projects table and add bank-related tables ([35fa2ca](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/35fa2ca0b2dea5bd9380e120df3c7085e590fa27))


### Bug Fixes

* prevent server start in development mode ([26a6b71](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/26a6b717d5d2e9fca54d07b29cd4117115b854fd))
* update empty state message in Dashboard component ([9282856](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/9282856999f5b09c963ef062be61a6aa889722ad))
* update role check for displaying farms in MemberDetail ([2987159](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/2987159d748b675f6d91650868359544034d97f2))

### [1.1.12](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.11...v1.1.12) (2026-07-19)


### Bug Fixes

* add filter to exclude database files from server resources ([b18232b](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/b18232b0aa3a957fd88bace9b93d32e0a0cac901))

### [1.1.11](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.10...v1.1.11) (2026-07-18)


### Bug Fixes

* move server to extraResources so forked process can access dependencies ([d620bc2](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/d620bc2af0f58dc912108d02169d00d225102907))

### [1.1.10](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.9...v1.1.10) (2026-07-18)

### [1.1.9](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.8...v1.1.9) (2026-07-18)


### Bug Fixes

* update lock file with server dependencies ([9b456bf](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/9b456bf09ce9c0c5814875322e729415b8cecef5))

### [1.1.8](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.7...v1.1.8) (2026-07-18)


### Bug Fixes

* add server dependencies to root and track build icon ([8988636](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/8988636388701b215f6a3f12c0f567b99b243767))
* prevent duplicate releases in GitHub Actions workflow ([ffa8d91](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/ffa8d91f6e20320ff35c8a91a74eff87bf6dd4db))

### [1.1.7](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.6...v1.1.7) (2026-07-18)


### Features

* add UpdateScreen component with update status and progress display ([0a5a185](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/0a5a1859686eaaeac4867bbc306be869ebf813dd))
* implement update state broadcasting and IPC communication for updates ([a855a03](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/a855a03f83474d64432029c20367cd9704924a78))
* implement update state handling and conditional rendering for UpdateScreen ([745dba0](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/745dba014b251dedb5d46a914b2ee9710a15d002))

### [1.1.6](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.5...v1.1.6) (2026-07-16)


### Features

* expose app version through environment variable in preload script ([41b826e](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/41b826e2b7aad3feb68053106371fa2ec64ae5c0))
* increase main window width and update page title format ([ed4e4ca](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/ed4e4ca618ffdd16a891cf7e201eedd78389fc6d))

### [1.1.5](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.4...v1.1.5) (2026-07-16)


### Features

* add preload script to expose app version to renderer process ([912c2b5](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/912c2b5a8371d9fe2e4fa39af7d7bd90576345b1))
* enable auto-hide for menu bar in main window ([c388e90](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/c388e901cf859602fe3af0c3b508ab029e57d69c))

### [1.1.4](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.3...v1.1.4) (2026-07-16)

### [1.1.3](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.2...v1.1.3) (2026-07-16)


### Features

* update sidebar to display build version and remove user info ([fbea9f3](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/fbea9f3226cb3007052245e109b1c9ee8c58f59e))

### [1.1.2](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.1...v1.1.2) (2026-07-16)


### Features

* add github workflow ([7a813d2](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/7a813d21d9a1e7928d7678a18cace9177f83eefb))
* enhance server and client integration with improved error handling and dynamic paths ([4d8fccc](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/4d8fccc8df58acde7882d7212f03cebf8f48f1ca))
* update README to reflect application details and deployment instructions ([43b2113](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/43b21138e85b8e807bc65da416ba534a419ac07c))

### [1.1.1](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.1.0...v1.1.1) (2026-07-16)

## [1.1.0](https://github.com/gmcp-dev/legacy-caraballo-enterprises/compare/v1.0.0...v1.1.0) (2026-07-16)

## 1.0.0 (2026-07-16)


### Features

* **build:** add electron desktop app with auto-updater ([2eece22](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/2eece220752303aa3d2daab992e59d5cc986fd77))
* LEGACY Caraballo Enterprises - sistema de gestion interno ([e8f97c0](https://github.com/gmcp-dev/legacy-caraballo-enterprises/commit/e8f97c0ec551f15c0121b97c0554cbe89c8c37ec))
