/**
 * circuit.rocks — storefront feature barrel.
 *
 * The public storefront. Originally static marketing; now also the home for the
 * dynamic PDP + guest cart + checkout (the feature's first backend calls). The
 * router imports the layout + pages from here; hooks/api/types are re-exported
 * for any other consumer.
 */

// Pages (consumed by the router)
export { HomePage } from "./pages/home-page";
export { ProductDetailPage } from "./pages/product-detail-page";
export { ProjectsListPage } from "./pages/projects-list-page";
export { ProjectDetailPage } from "./pages/project-detail-page";
export { BuildChatPage } from "./pages/build-chat-page";
export { BuildDetailPage } from "./pages/build-detail-page";
export { MyBuildsPage } from "./pages/my-builds-page";
export { CheckoutPage } from "./pages/checkout-page";

// Layout (pathless public shell with nav/footer/cart drawer)
export { StorefrontLayout } from "./components/storefront-layout";

// Hooks
export {
  useFeaturedProducts,
  useProduct,
  useProjects,
  useProject,
  useBuild,
  useResolveBuild,
  useResolveBuildImage,
  useMyBuilds,
  useDeleteBuild,
  useBuildChats,
  useBuildChat,
  useSendBuildChat,
  useDeleteBuildChat,
  useCart,
  useAddToCart,
  useUpdateCartLine,
  useRemoveCartLine,
  useCheckout,
  useRegions,
  useProvinces,
  useCityMun,
  useBarangays,
  useBranches,
  usePaymentMethods,
  useMyAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
  storefrontKeys,
} from "./hooks/use-storefront";

// Api (for prefetch / route loaders)
export {
  getFeaturedProducts,
  getProduct,
  getProjects,
  getProject,
  resolveBuild,
  resolveBuildImage,
  getBuild,
  getMyBuilds,
  deleteBuild,
  sendBuildChat,
  getBuildChats,
  getBuildChat,
  deleteBuildChat,
  getCart,
  addCartLine,
  updateCartLine,
  removeCartLine,
  checkout,
  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  setDefaultMyAddress,
} from "./api/storefront.api";

// Types
export {
  stockStateSchema,
  productSummarySchema,
  productDetailSchema,
  projectSummarySchema,
  projectPartSchema,
  projectDetailSchema,
  buildSourceSchema,
  buildLineStatusSchema,
  buildAlternativeSchema,
  buildPartSchema,
  buildUnmatchedLineSchema,
  buildDetailSchema,
  buildSummarySchema,
  BUILD_STATUS_META,
  BUILD_SOURCE_META,
  buildChatModeSchema,
  buildChatRoleSchema,
  buildChatMessageSchema,
  buildChatSummarySchema,
  buildChatDetailSchema,
  sendBuildChatResponseSchema,
  BUILD_CHAT_MODE_META,
  cartSchema,
  checkoutResultSchema,
  refOptionSchema,
  branchSummarySchema,
  paymentMethodSchema,
  savedAddressSchema,
  createAddressSchema,
  updateAddressSchema,
  fulfillmentTypeSchema,
  AVAILABILITY_META,
  type StockState,
  type ProductSummary,
  type ProductDetail,
  type ProjectSummary,
  type ProjectPart,
  type ProjectDetail,
  type BuildSource,
  type BuildLineStatus,
  type BuildAlternative,
  type BuildPart,
  type BuildUnmatchedLine,
  type BuildDetail,
  type BuildSummary,
  type BuildChatMode,
  type BuildChatRole,
  type BuildChatMessage,
  type BuildChatSummary,
  type BuildChatDetail,
  type SendBuildChatResponse,
  type StorefrontVariant,
  type Cart,
  type CartLine,
  type CheckoutResult,
  type RefOption,
  type BranchSummary,
  type PaymentMethod,
  type SavedAddress,
  type CreateAddressInput,
  type UpdateAddressInput,
  type FulfillmentType,
} from "./types/storefront.types";

// Presentational components
export { AnnouncementBar } from "./components/announcement-bar";
export { BrandTile } from "./components/brand-tile";
export { DateBlockCard } from "./components/date-block-card";
export { Footer } from "./components/footer";
export { ImgTile } from "./components/img-tile";
export { NavHeader } from "./components/nav-header";
export { ProductCard } from "./components/product-card";
export { SectionLabel } from "./components/section-label";
export { StatBlock } from "./components/stat-block";

// Static demo data
export {
  BRANDS,
  EVENTS,
  FEATURED,
  MEGA,
  MOVERS,
  PROPS,
  type Product,
} from "./data";
