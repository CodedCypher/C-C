**CircuitForge**

*A build-to-cart assistant on the circuit.rocks storefront — turning maker inspiration into a verified, in-stock cart in seconds.*

1. **The Problem**

   Every day, Filipino makers, electronics hobbyists, and engineering students discover exciting project tutorials online. They get inspired by a YouTube build, a schematic on Reddit, or a parts list shared on a forum. But the moment they try to turn that inspiration into a real purchase, the journey breaks down.

   

   The maker's journey collapses at the Bill of Materials (BOM) stage. Translating a discovered project into purchasable components forces the maker to do the following — manually, one part at a time:

   

* Identify each component by name and exact specification

* Search for it across supplier catalogs and physical stores

* Verify stock availability and correct packaging quantities

* Find alternatives when preferred components are out of stock

* Repeat this for every single part in the list

  For local makers in the Philippines, this problem is worse. Component availability is unpredictable, supplier inventory data is often offline or outdated, and there is no centralized platform connecting project inspiration to local stock. Most makers end up visiting multiple stores, messaging suppliers on Facebook, or simply giving up.


  **The result:** Project abandonment is the norm, not the exception. Lost sales for suppliers like Circuit Rocks. Discouraged hobbyists who never complete their builds. A maker community that is growing in interest but shrinking in completion rate.


2. **The Solution/Innovation**

   CircuitForge is a build-to-cart assistant built into the **circuit.rocks** storefront. Its core innovation is an **AI build assistant**: a maker drops in whatever inspiration they have — a photo of a schematic or parts list, or a typed description — and CircuitForge resolves it into a ready-to-checkout cart of verified, in-stock components. No manual searching, comparing, or stock-checking, one part at a time.

**How the AI assistant works**

   The maker opens the build chat and describes what they want to build (or uploads a photo). The assistant (powered by Groq, with a Google Gemini vision fallback) interprets the request, proposes a parts list, and **matches every part against the live circuit.rocks catalog**. When a recommended part is out of stock, the assistant automatically swaps in a verified in-stock alternative and flags the substitution. The result is a resolved build — every line matched to a real SKU with current stock status — that the maker can save, share by link, and add to cart in one click.

**Two complementary paths to the same in-stock cart**

| **AI Build Assistant (the hero)** | The maker brings inspiration in any form — schematic/BOM photo or free text — and the assistant resolves it into matched, in-stock parts with automatic out-of-stock alternatives. Builds are saved and shareable. |
| :---- | :---- |
| **Curated Project Kits** | For makers who want a guaranteed path, Circuit Rocks experts pre-curate complete projects (e.g., Arduino Line Follower, DIY Bluetooth Speaker, Raspberry Pi Weather Station) as kits — a built variant plus a verified Bill of Materials — that drop into the cart with a single "Add all to cart". |

The innovation is the separation of curation from selection. Circuit Rocks owns the expert/inventory layer — the catalog, stock status, kits, and verified alternatives. The maker (with the AI assistant doing the heavy lifting) only makes the final decision. CircuitForge removes every step in between.

**The maker journey becomes three steps:**

* **Bring your build** — upload a schematic/parts-list photo or describe it in chat (or just pick a curated Project Kit).

* **Let the assistant resolve it** — the AI matches each part to verified, in-stock circuit.rocks components, auto-swapping out-of-stock items for in-stock alternatives.

* **Check out** — one click adds the resolved parts to your cart; finish with delivery or in-store pickup.


3. **Solution Details/Components/Features**   

| Feature / Module | Who Uses It | What It Does |
| :---- | :---- | :---- |
| **AI Build Assistant** | User | A chat assistant that turns inspiration into parts. Accepts **text or an uploaded image** (schematic/BOM photo). Powered by Groq (primary) + Google Gemini (vision fallback). Conversation modes for brainstorming, pressure-testing (grill), and refining (impeccable) a build. |
| **Smart Parts Matching** | User | Every suggested part is matched against the live circuit.rocks catalog. Out-of-stock parts are auto-swapped for verified in-stock alternatives; unmatched parts are flagged with the reason so nothing silently disappears. |
| **Saved & Shareable Builds** | User | Every resolved build is persisted (for signed-in users *and* guests, via cookie) and viewable at a shareable link. A maker can reshare a build so a teammate sees the same parts with current stock and adds them to cart independently. |
| **Project Catalog (Curated Kits)** | Admin \+ User | Admins publish curated project kits — a built variant plus a verified BOM, with estimated cost and in-stock badge. Users browse the gallery and open any kit. |
| **Curated Parts List (BOM)** | Admin | For each kit, admins define a complete Bill of Materials from raw materials and components, backed by live Circuit Rocks inventory. Only one BOM is active per variant at a time. |
| **Ready-to-Cart Output** | User | Both the AI build and any curated kit produce a one-click "Add (all) to cart" — a consolidated, checkout-ready cart with per-item stock status and total cost estimate. |
| **Inventory Status Layer** | Admin \+ User | Each component is surfaced as In Stock, Low Stock, or Out of Stock. The platform automatically routes around out-of-stock items via alternatives, preventing dead ends. |
| **Storefront & Cart** | User | Full product browsing (catalog, product detail with variant/option pickers), a persistent guest or signed-in cart, and a 3-step checkout with delivery **or** in-store pickup, Philippine address cascade (region → province → city → barangay), and manual payment-proof upload. |
| **Customer Accounts** | User | Register / login (email + password, plus Google OAuth), saved delivery addresses, profile, and full order history with status tracking. |
| **Admin Dashboard** | Admin | Central control panel with metrics (orders, revenue, inventory alerts) and management of products, kits, inventory, and orders. |
| **Component Database** | Admin | A searchable catalog of all Circuit Rocks products and variants, plus tracked raw materials, with specs, categories, SKUs, and cross-reference data for alternatives. |
| **Multi-Warehouse Inventory & Transfers** | Admin | Per-warehouse stock buckets with global rollups, reorder points, branch↔warehouse mapping (many-to-many), and inter-warehouse stock transfers with a full lifecycle. |
| **In-house Manufacturing** | Admin | Build orders consume raw materials against a BOM to produce finished/kit variants, with a draft → planned → in-progress → completed lifecycle. |
| **Order Fulfillment** | Admin | Verify uploaded payment proof, then move orders through ship → deliver, with cancel support. Configurable manual payment methods (with QR codes). |
| **Difficulty & Category Tags** | Admin \+ User | Products and projects carry category tags (and, where set, difficulty) so makers find builds appropriate to their skill. *(Difficulty tagging is partially surfaced in the UI.)* |

4. **Proof of Concept**

The CircuitForge proof of concept is a **working full-stack application** — not a wireframe — demonstrating the complete journey from inspiration to a placed order. The following screens/flows are live in the prototype:

**Maker (customer) experience**

* Home — featured products, curated project rails, and a clear path into the build assistant

* Product Detail — image gallery, variant/option pickers, live stock status, add-to-cart

* Projects Gallery & Project Detail — curated kits with in-stock badges and **one-click "Add all to cart"**

* AI Build Chat — describe / upload an image; the assistant replies with an inline **resolved-build card** (matched parts, stock status, auto-swapped alternatives)

* Build Detail & My Builds — a shareable resolved build with an alternates picker, plus a history of saved builds (guest or signed-in)

* Cart Drawer & 3-Step Checkout — contact → delivery/pickup (with PH address cascade) → payment method + proof upload → order confirmation

* Account — order history with status tracking, saved addresses, and profile

**Admin (Circuit Rocks) experience**

* Dashboard — order, revenue, and inventory-alert metrics

* Products, Project Kits, Inventory, Orders — catalog and kit curation, per-warehouse stock management, and the order fulfillment workflow (verify payment → ship → deliver)

* Manufacturing & Logistics — BOMs, build orders, raw materials, warehouses, branches, stock transfers, and payment-method configuration

The maker flow follows a discovery-to-purchase path with the AI assistant as the spine: bring inspiration in any form → assistant resolves to in-stock parts → one decision (keep or swap an alternative) → checkout. This keeps cognitive load on the maker to a minimum.

5. **Prototype**   

| Frontend | React 19 \+ Vite 8 (client-side SPA) — TanStack Router \+ TanStack Query, Zod, react-hook-form, Axios, Recharts, Tailwind CSS 4 |
| :---- | :---- |
| **Backend** | NestJS 11 (REST, domain modules) \+ Prisma 7 ORM |
| **Database** | PostgreSQL (dev: Docker container `circuit-pg`, port 5433) |
| **Auth** | Passport (Local \+ JWT \+ Google OAuth 2.0); 15-min JWT access \+ SHA-256-hashed refresh token in a Session table; httpOnly cookies `cr_at` / `cr_rt`; roles CUSTOMER / STAFF / ADMIN / SUPERADMIN |
| **AI Integration** | Groq (primary — Llama 3.3 70B) \+ Google Gemini (fallback — 2.5 Flash, vision-capable). Powers the build assistant and the parts matcher. |
| **Hosting** | Local development / Docker Compose (Postgres). Not yet deployed to a public host. |
| **Repository** | [https://github.com/CodedCypher/C-C](https://github.com/CodedCypher/C-C)  |
| **Live URL** | n/a (local development) |

   

6. **Team Members & Roles**   

| Name | Role | Responsibilities |
| :---- | :---- | :---- |
| **Rodelio G. Cua** | _TODO: role_ | _TODO: responsibilities_ |
| **Jim Danielle P. Encarnacion** | Technical Lead / Full-Stack Developer | Full-stack architecture and build — React SPA frontend, NestJS \+ Prisma/PostgreSQL backend, AI build-assistant integration (Groq/Gemini), inventory and checkout systems. |
| **Lanz Martene M. Guiab** | Video Editor | Demo video production and editing. |
| **John Emmanuel O. Santos** | _TODO: role_ | _TODO: responsibilities_ |
| **Brian V. Tanteo** | Project Lead / Researcher / Brief Writer / Presenter | Project coordination, research, brief/documentation writing, and the pitch presentation. |

   

7. **References**

   *Representative sources — to be finalized by the team.*

* Maker inspiration channels the product targets: YouTube build tutorials, [Hackster.io](https://www.hackster.io/), [Instructables](https://www.instructables.com/), and maker communities on Reddit, Facebook, and Discord.

* Circuit Rocks — the electronics supplier the platform is built around: [https://circuit.rocks](https://circuit.rocks)

* Core technology documentation: [React](https://react.dev/), [Vite](https://vite.dev/), [TanStack Router & Query](https://tanstack.com/), [NestJS](https://nestjs.com/), [Prisma](https://www.prisma.io/), [Groq](https://groq.com/), and [Google Gemini API](https://ai.google.dev/).

8. **Use of AI in the project**   
   The following AI tool was used during the development of **CircuitForge**. Its use is disclosed in full in accordance with the hackathon rules and submission guidelines:

| Claude (Anthropic) | Full development — architecture, frontend SPA, NestJS backend, AI build-assistant integration, debugging, and documentation. |
| :---- | :---- |

   **AI inside the product (runtime):** CircuitForge's build assistant and parts matcher are themselves AI-powered, using **Groq** (primary) and **Google Gemini** (fallback) to interpret maker inspiration and resolve it into in-stock parts. This is a product feature, distinct from the development tooling above.

   All AI-generated content was reviewed, validated, and edited by the team before inclusion in any submission. Core decisions on product design, architecture, and presentation were made by team members.

   

9. **Target Customer**

   CircuitForge serves two distinct customer groups within the Filipino maker ecosystem. Understanding both is critical — the platform only works when the admin side (Circuit Rocks) and the user side (makers) are both engaged.

| Primary Customer | Circuit Rocks — the electronics supplier that powers the platform. Circuit Rocks benefits from CircuitForge by converting browsing makers into direct, project-complete purchases. Every project template they curate, and every build the assistant resolves, is a sales funnel for their component catalog. |
| :---- | :---- |
| **End Users** | Filipino makers, electronics hobbyists, engineering students, and DIY enthusiasts who discover project tutorials and need a fast, reliable way to source the components locally. |
| **Location** | Circuit Rocks' physical and online presence as the primary fulfillment channel. |
| **Behavior** | Regularly consumes YouTube tutorials, Instructables, and Hackster.io content. Purchases components online (Shopee, Lazada) or in-store. Active in maker communities on Facebook, Reddit, and Discord. |
| **Pain Point** | Spends hours per project just sourcing components. Frequently abandons builds due to out-of-stock parts or inability to find local alternatives. Relies on informal Facebook messages to suppliers to check availability. |
| **Purchase Trigger** | Discovers a project tutorial they want to build — the inspiration moment. CircuitForge captures the user at this exact point and converts it to a purchase before motivation fades. |

   

10. **User Persona**

| **Name** | Miguel "Migs" Santos |
| :---- | :---- |
| **Age** | 21 |
| **Role** | 3rd-year Electronics Engineering student; weekend hobbyist and aspiring robotics builder |
| **Location** | Quezon City, Metro Manila |
| **Tech comfort** | High — codes in Arduino/Python, follows YouTube and Hackster.io builds, active in a campus robotics club and several maker Facebook groups |
| **Goals** | Finish the projects he gets excited about; source all the right parts quickly and locally; stay within a student budget; learn by actually building, not by hunting for components |
| **Frustrations** | Spends hours translating a tutorial into a buyable parts list; finds half the parts out of stock with no obvious substitute; ends up messaging multiple Facebook sellers to check availability; often loses momentum and abandons the build entirely |
| **Behavior** | Discovers a build on YouTube → screenshots the parts list or schematic → tries to find each part on Shopee/Lazada or in-store → gives up when stock is unclear |
| **How CircuitForge helps** | Migs uploads the schematic photo into the build assistant. CircuitForge resolves it into a verified, in-stock cart of circuit.rocks parts in seconds — auto-swapping anything out of stock — and he checks out with in-store pickup near campus. The build that would have died at the BOM stage gets finished. |
