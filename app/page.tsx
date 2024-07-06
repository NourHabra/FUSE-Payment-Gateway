/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateAesKey, encryptAesKey, encryptData, decryptData } from "../lib/crypto-utils";
import axios from "axios";
import { useRouter } from "next/navigation";

// Base URL for the backend API
const baseUrl = "https://fuse-backend-x7mr.onrender.com";

// Interface for the props passed to the Home component
interface HomeProps {
  billNumber?: string;
}

// Interface for the Bill object
interface Bill {
  id: string;
  category: string;
  merchantAccount: {
    user: {
      name: string;
    };
  };
  details: string;
  amount: number;
  // other properties
}

// Interface for the Card object
interface Card {
  id: string;
  cvv: string;
  expiryDate: string;
  cardName: string; // Add this line
  // other properties
}

// Home component definition
export default function Home({ billNumber }: HomeProps) {
  const router = useRouter(); // Next.js router for navigation
  const [step, setStep] = useState<1 | 2 | 3>(1); // State to manage the current step in the process
  const [email, setEmail] = useState(""); // State to manage the email input
  const [password, setPassword] = useState(""); // State to manage the password input
  const [aesKey, setAesKey] = useState(""); // State to store the AES key
  const [loading, setLoading] = useState(false); // State to manage the loading state
  const [cards, setCards] = useState<Card[]>([]); // State to store the list of cards
  const [selectedCard, setSelectedCard] = useState<Card | null>(null); // State to store the selected card
  const [bill, setBill] = useState<Bill | null>(null); // State to store the bill details
  const [transactionStatus, setTransactionStatus] = useState(""); // State to store the transaction status
  const [jwt, setJwt] = useState(""); // State to store the JWT token

  // Function to search for a bill using the bill number
  const searchForBill = useCallback(async (billNumber: string) => {
    if (!billNumber) return;
    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/bill/${billNumber}`, { jwt });
      const decryptedPayload = decryptData(response.data.payload, aesKey);
      setBill(decryptedPayload);
    } catch (error) {
      alert('Failed to fetch bill');
    } finally {
      setLoading(false);
    }
  }, [aesKey, jwt]);

  // Effect to search for a bill when the bill number or selected card changes
  useEffect(() => {
    if (billNumber && selectedCard) {
      searchForBill(billNumber);
    }
  }, [selectedCard, billNumber, searchForBill]);

  // Effect to set the first card as the selected card when the list of cards changes
  useEffect(() => {
    if (cards.length > 0) {
      setSelectedCard(cards[0]);
    }
  }, [cards]);

  // Function to handle the first step of the login process
  const handleLoginStep1 = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/key/publicKey`, { email });
      const { publicKey } = response.data;
      const newAesKey = generateAesKey();
      setAesKey(newAesKey);
      const encryptedAesKey = encryptAesKey(publicKey, newAesKey);
      const response2 = await axios.post(`${baseUrl}/key/setAESkey`, { email, encryptedAesKey });
      if (response2.status === 200) {
        setStep(2);
      }
    } catch (error) {
      alert('Failed to initiate login process');
    } finally {
      setLoading(false);
    }
  };

  // Function to handle the second step of the login process
  const handleLoginStep2 = async () => {
    setLoading(true);
    try {
      const payload = encryptData({ email, password }, aesKey);
      const response = await axios.post(`${baseUrl}/auth/login`, { email, payload });
      const decryptedPayload = decryptData(response.data.payload, aesKey);
      setJwt(decryptedPayload.jwt);
      await fetchCards(decryptedPayload.jwt, aesKey);
      setStep(3);
    } catch (error) {
      alert('Failed to login');
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch the list of cards for the user
  const fetchCards = async (jwt: string, aesKey: string) => {
    try {
      const response = await axios.post(`${baseUrl}/card/user`, { jwt });
      const decryptedPayload = decryptData(response.data.payload, aesKey);
      setCards(decryptedPayload);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Function to handle the payment of a bill
  const payBill = async () => {
    if (!bill) {
      alert('Bill is not available');
      return;
    }

    if (!selectedCard) {
      alert('No card selected');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/bill/pay/${bill.id}`, {
        jwt,
        payload: encryptData({
          cardId: selectedCard.id,
          cvv: selectedCard.cvv,
          month: (new Date(selectedCard.expiryDate).getMonth() + 1).toString(),
          year: (new Date(selectedCard.expiryDate).getFullYear()).toString(),
        }, aesKey),
      });
      decryptData(response.data.payload, aesKey);
      setTransactionStatus("success");
    } catch (error) {
      alert('Failed to pay bill');
      setTransactionStatus("failure");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
      {step < 3 ? (
        <UICard className="w-full max-w-md">
          <CardHeader className="flex justify-between items-center">
            <img src="/assets/FuseLogo.png" alt="Fuse Logo" className="h-8 w-8" />
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={(e) => { e.preventDefault(); handleLoginStep1(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : "Next"}
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleLoginStep2(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : "Login"}
                </Button>
              </form>
            )}
          </CardContent>
        </UICard>
      ) : (
        <div className="w-full md:w-10/12 lg:w-8/12 flex flex-col md:flex-row gap-4 md:gap-8">
          <UICard className="w-full md:w-1/2">
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl">Select a Card</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cards.map((card) => (
                  <div key={card.id}>
                    <div>
                      <p className="text-xs sm:text-sm opacity-70 mb-1">Card Name:</p>
                      <p className="text-sm sm:text-lg font-bold">{card.cardName}</p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm opacity-70 mb-1">Balance:</p>
                      <p className="text-sm sm:text-lg font-bold">{/* Balance value here */}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </UICard>

          {selectedCard && bill && (
            <UICard className="w-full md:w-1/2">
              <CardHeader>
                <CardTitle className="text-xl sm:text-2xl">Bill Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm sm:text-base">
                  <p><strong>Bill Number:</strong> {bill.id}</p>
                  <p><strong>Category:</strong> {bill.category}</p>
                  <p><strong>Merchant:</strong> {bill.merchantAccount.user.name}</p>
                  <p><strong>Description:</strong> {bill.details}</p>
                  <p><strong>Amount:</strong> ${bill.amount}</p>
                  <Button onClick={payBill} className="w-full mt-4" disabled={loading}>
                    {loading ? "Processing..." : "Pay Bill"}
                  </Button>
                </div>
                {transactionStatus && (
                  <div className="mt-4 text-center">
                    {transactionStatus === "success" ? (
                      <p className="text-green-500">Payment completed successfully.</p>
                    ) : (
                      <p className="text-red-500">An error occurred, please try again later.</p>
                    )}
                  </div>
                )}
              </CardContent>
            </UICard>
          )}
        </div>
      )}
    </div>
  );
}
