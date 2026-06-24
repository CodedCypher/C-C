/**
 * circuit.rocks — payment-methods feature: query + mutation hooks. Mirrors the
 * canonical pattern: a `paymentMethodKeys` factory, `useQuery` reads, and
 * `useMutation` writes that invalidate on success and DON'T swallow errors.
 */

import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "~/lib/query-client";
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethods,
  updatePaymentMethod,
  uploadPaymentMethodQr,
  type CreatePaymentMethodBody,
  type UpdatePaymentMethodBody,
} from "../api/payment-methods.api";

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  list: () => ["payment-methods", "list"] as const,
};

export function usePaymentMethods() {
  return useQuery({
    queryKey: paymentMethodKeys.list(),
    queryFn: () => getPaymentMethods(),
  });
}

export function useCreatePaymentMethod() {
  return useMutation({
    mutationFn: (body: CreatePaymentMethodBody) => createPaymentMethod(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
    },
  });
}

export function useUpdatePaymentMethod(id: string) {
  return useMutation({
    mutationFn: (body: UpdatePaymentMethodBody) =>
      updatePaymentMethod(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
    },
  });
}

export function useDeletePaymentMethod() {
  return useMutation({
    mutationFn: (id: string) => deletePaymentMethod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
    },
  });
}

export function useUploadPaymentMethodQr(id: string) {
  return useMutation({
    mutationFn: (file: File) => uploadPaymentMethodQr(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all });
    },
  });
}
