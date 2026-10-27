import { SupplierOrderDetailScreen } from "./SupplierOrderDetailScreen";

/**
 * Admin-only details use the same redesigned order view.
 * The administrator route is protected server-side and its sensitive section is
 * not mounted for any supplier account. Suppliers have their own safe endpoint.
 */
export function OrderDetailScreen({id,onBack}:{id:string;onBack:()=>void}){
  return <SupplierOrderDetailScreen id={id} onBack={onBack} adminMode />;
}
