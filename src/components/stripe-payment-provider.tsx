import { StripeProvider } from "@stripe/stripe-react-native";
import type { PropsWithChildren } from "react";

export default function StripePaymentProvider({ children }: PropsWithChildren) {
  const clavePublica = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  if (!clavePublica) {
    if (__DEV__) console.error("Falta EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={clavePublica}
      urlScheme="mueveloya"
      merchantIdentifier="merchant.com.joelbur.MueveloYa"
    >
      <>{children}</>
    </StripeProvider>
  );
}
