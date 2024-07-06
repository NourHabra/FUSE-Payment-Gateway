'use client'
// app/page.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateAesKey, encryptAesKey, encryptData, decryptData } from "../lib/crypto-utils";
import axios from "axios";
import { useRouter } from "next/navigation";

const baseUrl = "https://fuse-backend-x7mr.onrender.com";

interface HomeProps {
  billNumber?: string;
}

export default function Home({ billNumber }: HomeProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [aesKey, setAesKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [bill, setBill] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState("");
  const [jwt, setJwt] = useState("");

  useEffect(() => {
    if (billNumber && selectedCard) {
      searchForBill(billNumber);
    }
  }, [selectedCard, billNumber]);

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

  const fetchCards = async (jwt: string, aesKey: string) => {
    try {
      const response = await axios.post(`${baseUrl}/card/user`, { jwt });
      const decryptedPayload = decryptData(response.data.payload, aesKey);
      setCards(decryptedPayload);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const searchForBill = async (billNumber: string) => {
    if (!billNumber) return;
    setLoading(true);
    try {
      const response = await axios.post(`${baseUrl}/bill/${billNumber}`, { jwt });
      const decryptedPayload = decryptData(response.data.payload, aesKey);
      setBill(decryptedPayload);
      setLoading(false);
    } catch (error) {
      alert('Failed to fetch bill');
      setLoading(false);
    }
  };

  const payBill = async () => {
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
      const decryptedPayload = decryptData(response.data.payload, aesKey);
      setTransactionStatus("success");
      setLoading(false);
    } catch (error) {
      alert('Failed to pay bill');
      setTransactionStatus("failure");
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
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
          ) : step === 2 ? (
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
          ) : (
            <div>
              <h2 className="text-xl font-bold mb-4">My Cards</h2>
              <div className="space-y-4">
                {cards.map((card, index) => (
                  <div key={index} className="p-4 border rounded-lg" onClick={() => setSelectedCard(card)}>
                    <p><strong>Card Name:</strong> {card.cardName}</p>
                    <p><strong>Balance:</strong> {card.balance}</p>
                    <p><strong>CVV:</strong> {card.cvv}</p>
                    <p><strong>Expiry Date:</strong> {card.expiryDate}</p>
                  </div>
                ))}
              </div>
              {selectedCard && (
                <div className="mt-4">
                  <h2 className="text-xl font-bold mb-4">Selected Card</h2>
                  <p><strong>Card Name:</strong> {selectedCard.cardName}</p>
                  <p><strong>Balance:</strong> {selectedCard.balance}</p>
                  <p><strong>CVV:</strong> {selectedCard.cvv}</p>
                  <p><strong>Expiry Date:</strong> {selectedCard.expiryDate}</p>
                  {bill && (
                    <div className="mt-4">
                      <h2 className="text-xl font-bold mb-4">Bill Details</h2>
                      <p><strong>Bill Number:</strong> {bill.id}</p>
                      <p><strong>Category:</strong> {bill.category}</p>
                      <p><strong>Merchant:</strong> {bill.merchantAccount.user.name}</p>
                      <p><strong>Description:</strong> {bill.details}</p>
                      <p><strong>Amount:</strong> {bill.amount}</p>
                      <Button onClick={payBill} className="w-full mt-4" disabled={loading}>
                        {loading ? "Loading..." : "Pay Bill"}
                      </Button>
                    </div>
                  )}
                  {transactionStatus && (
                    <div className="mt-4">
                      {transactionStatus === "success" ? (
                        <p className="text-green-500">Payment completed successfully.</p>
                      ) : (
                        <p className="text-red-500">An error occurred, please try again later.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}