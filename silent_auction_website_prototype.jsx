import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowUpCircle,
  Download,
  Gavel,
  HeartHandshake,
  LayoutDashboard,
  ListPlus,
  Projector,
  QrCode,
  Search,
  TabletSmartphone,
  TimerReset,
  UserRound,
} from "lucide-react";

type Bid = {
  amount: number;
  bidderNumber: string;
  createdAt: string;
};

type AuctionItem = {
  id: string;
  title: string;
  description: string;
  donorFirstName: string;
  donorLastName: string;
  estimatedRetailValue: number;
  startingBid: number;
  image: string;
  bids: Bid[];
  createdAt: string;
};

type SubmissionForm = {
  title: string;
  description: string;
  donorFirstName: string;
  donorLastName: string;
  estimatedRetailValue: string;
  startingBid: string;
  image: string;
};

const STORAGE_KEY = "church-silent-auction-demo-v4";
const BIDDER_KEY = "church-silent-auction-bidder-number-v4";
const CHECKIN_KEY = "church-silent-auction-checkin-v4";
const MODE_KEY = "church-silent-auction-mode-v4";
const ADMIN_UNLOCK_KEY = "church-silent-auction-admin-unlocked-v4";
const ADMIN_PASSWORD = "1988";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80";

const seedItems: AuctionItem[] = [
  {
    id: crypto.randomUUID(),
    title: "Homemade Cinnamon Rolls",
    description: "Fresh baked dozen of cinnamon rolls.",
    donorFirstName: "Youth",
    donorLastName: "Volunteer",
    estimatedRetailValue: 25,
    startingBid: 15,
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80",
    bids: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    title: "Yard Cleanup Service",
    description: "Two hours of yard cleanup by the youth group.",
    donorFirstName: "Youth",
    donorLastName: "Group",
    estimatedRetailValue: 60,
    startingBid: 40,
    image:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?auto=format&fit=crop&w=1200&q=80",
    bids: [],
    createdAt: new Date().toISOString(),
  },
];

function generateBidderNumber(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function getHighestBid(item: AuctionItem) {
  if (!item.bids.length) {
    return {
      amount: Number(item.startingBid),
      bidderNumber: "—",
      createdAt: "",
      isStartingBid: true,
    };
  }

  return [...item.bids].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function toNumber(value: string) {
  return Number(value || 0);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildWinnerCsv(items: AuctionItem[]) {
  const rows = items.map((item) => {
    const highest = getHighestBid(item);
    const donor = `${item.donorFirstName || ""} ${item.donorLastName || ""}`.trim();
    return [
      `"${item.title.replaceAll('"', '""')}"`,
      highest.amount,
      highest.bidderNumber,
      `"${donor.replaceAll('"', '""')}"`,
    ].join(",");
  });

  return "Item,Winning Bid,Winner Bidder Number,Donor\n" + rows.join("\n");
}

const __auctionSelfTests = [
  (() => getHighestBid({ ...seedItems[0], bids: [] }).amount === seedItems[0].startingBid)(),
  (() => {
    const item: AuctionItem = {
      ...seedItems[0],
      bids: [
        { amount: 20, bidderNumber: "1111", createdAt: "2026-03-15T01:00:00.000Z" },
        { amount: 25, bidderNumber: "2222", createdAt: "2026-03-15T02:00:00.000Z" },
      ],
    };
    return getHighestBid(item).bidderNumber === "2222";
  })(),
  (() => buildWinnerCsv(seedItems).startsWith("Item,Winning Bid,Winner Bidder Number,Donor"))(),
];

if (__auctionSelfTests.some((result) => !result)) {
  console.error("Silent auction self-test failed.");
}

export default function SilentAuction() {
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [bidderNumber, setBidderNumber] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [mode, setMode] = useState<"bid" | "donate" | null>(null);
  const [biddingClosed, setBiddingClosed] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [leaderboardNow, setLeaderboardNow] = useState(Date.now());
  const [tabletBidderNumber, setTabletBidderNumber] = useState("");
  const [auctionEndsAt, setAuctionEndsAt] = useState<number>(() => Date.now() + 1000 * 60 * 15);
  const [softCloseWindowMinutes] = useState(2);
  const [softCloseExtensionMinutes] = useState(2);
  const [checkinName, setCheckinName] = useState("");
  const [currentTab, setCurrentTab] = useState("items");
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const [submission, setSubmission] = useState<SubmissionForm>({
    title: "",
    description: "",
    donorFirstName: "",
    donorLastName: "",
    estimatedRetailValue: "",
    startingBid: "",
    image: "",
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setItems(JSON.parse(saved));
    } else {
      setItems(seedItems);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seedItems));
    }

    const savedCheckin = localStorage.getItem(CHECKIN_KEY);
    const savedBidder = localStorage.getItem(BIDDER_KEY);
    const savedMode = localStorage.getItem(MODE_KEY) as "bid" | "donate" | null;
    const savedAdminUnlocked = localStorage.getItem(ADMIN_UNLOCK_KEY) === "true";

    if (savedCheckin && savedBidder) {
      setCheckedIn(true);
      setBidderNumber(savedBidder);
    }
    if (savedMode) setMode(savedMode);
    setAdminUnlocked(savedAdminUnlocked);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem(ADMIN_UNLOCK_KEY, String(adminUnlocked));
  }, [adminUnlocked]);

  useEffect(() => {
    const interval = setInterval(() => setLeaderboardNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return items;

    return items.filter((item) => {
      const donor = `${item.donorFirstName || ""} ${item.donorLastName || ""}`.toLowerCase();
      return (
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        donor.includes(term)
      );
    });
  }, [items, search]);

  const itemsWithLeaderStatus = useMemo(() => {
    return items.map((item) => {
      const highest = getHighestBid(item);
      const isWinning = highest.bidderNumber !== "—" && String(highest.bidderNumber) === String(bidderNumber);
      const hasBidOnItem = item.bids.some((bid) => String(bid.bidderNumber) === String(bidderNumber));
      const isOutbid = hasBidOnItem && !isWinning;
      return { ...item, highest, isWinning, isOutbid };
    });
  }, [items, bidderNumber]);

  const winningItems = useMemo(
    () => itemsWithLeaderStatus.filter((item) => item.isWinning),
    [itemsWithLeaderStatus]
  );

  const outbidItems = useMemo(
    () => itemsWithLeaderStatus.filter((item) => item.isOutbid),
    [itemsWithLeaderStatus]
  );

  const checkoutItems = useMemo(() => {
    if (!biddingClosed) return [];
    return items
      .map((item) => ({ ...item, highest: getHighestBid(item) }))
      .filter(
        (item) =>
          item.highest.bidderNumber !== "—" && String(item.highest.bidderNumber) === String(bidderNumber)
      );
  }, [items, bidderNumber, biddingClosed]);

  const checkoutTotal = useMemo(
    () => checkoutItems.reduce((sum, item) => sum + Number(item.highest.amount || 0), 0),
    [checkoutItems]
  );

  const projectorData = useMemo(() => {
    void leaderboardNow;
    return [...items]
      .map((item) => ({ ...item, highest: getHighestBid(item) }))
      .sort((a, b) => b.highest.amount - a.highest.amount);
  }, [items, leaderboardNow]);

  const timeRemainingMs = Math.max(auctionEndsAt - Date.now(), 0);
  const remainingMinutes = Math.floor(timeRemainingMs / 60000);
  const remainingSeconds = Math.floor((timeRemainingMs % 60000) / 1000);
  const isInSoftCloseWindow =
    timeRemainingMs > 0 && timeRemainingMs <= softCloseWindowMinutes * 60 * 1000;
  const registrationUrl = "https://desert-ridge-ward-youth-auction.example/register";

  function handleCheckin() {
    const number = generateBidderNumber();
    localStorage.setItem(BIDDER_KEY, number);
    localStorage.setItem(CHECKIN_KEY, "true");
    setBidderNumber(number);
    setCheckedIn(true);
    setStatusMessage(
      `Welcome${checkinName ? `, ${checkinName}` : ""}. Your anonymous bidder number is #${number}.`
    );
  }

  function chooseMode(nextMode: "bid" | "donate") {
    setMode(nextMode);
    localStorage.setItem(MODE_KEY, nextMode);
  }

  function openBid(item: AuctionItem) {
    setSelectedItem(item);
    setBidAmount(String(getHighestBid(item).amount + 1));
  }

  function applyIncrement(increment: number) {
    if (!selectedItem) return;
    const highest = getHighestBid(selectedItem).amount;
    setBidAmount(String(highest + increment));
  }

  function placeBid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedItem) return;

    if (biddingClosed) {
      setStatusMessage("Bidding is currently closed.");
      return;
    }

    const amount = Number(bidAmount);
    const highest = getHighestBid(selectedItem).amount;

    if (!amount || amount <= highest) {
      setStatusMessage(`Bid must be higher than ${formatCurrency(highest)}.`);
      return;
    }

    const bidderToUse = tabletBidderNumber || bidderNumber || "";

    setItems((prev) =>
      prev.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              bids: [
                ...item.bids,
                {
                  amount,
                  bidderNumber: bidderToUse,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : item
      )
    );

    const msRemainingBeforeBid = auctionEndsAt - Date.now();
    if (msRemainingBeforeBid <= softCloseWindowMinutes * 60 * 1000) {
      setAuctionEndsAt(Date.now() + softCloseExtensionMinutes * 60 * 1000);
      setStatusMessage(
        `Bid placed successfully on ${selectedItem.title}. You are currently winning at ${formatCurrency(
          amount
        )}. Auction extended by ${softCloseExtensionMinutes} minutes.`
      );
    } else {
      setStatusMessage(
        `Bid placed successfully on ${selectedItem.title}. You are currently winning at ${formatCurrency(
          amount
        )}.`
      );
    }

    setSelectedItem(null);
    setBidAmount("");
    setTabletBidderNumber("");
  }

  function handleAdminTabClick() {
    if (adminUnlocked) {
      setCurrentTab("admin");
      return;
    }

    const pwd = window.prompt("Enter admin password");
    if (pwd === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setCurrentTab("admin");
      setStatusMessage("Admin unlocked.");
    } else if (pwd !== null) {
      setStatusMessage("Incorrect admin password.");
    }
  }

  async function handleImageUpload(file?: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setSubmission((prev) => ({ ...prev, image: dataUrl }));
  }

  function handleDonationSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const newItem: AuctionItem = {
      id: crypto.randomUUID(),
      title: submission.title.trim(),
      description: submission.description.trim(),
      donorFirstName: submission.donorFirstName.trim(),
      donorLastName: submission.donorLastName.trim(),
      estimatedRetailValue: toNumber(submission.estimatedRetailValue),
      startingBid: toNumber(submission.startingBid),
      image: submission.image || FALLBACK_IMAGE,
      bids: [],
      createdAt: new Date().toISOString(),
    };

    if (
      !newItem.title ||
      !newItem.description ||
      !newItem.donorFirstName ||
      !newItem.donorLastName ||
      !newItem.estimatedRetailValue ||
      !newItem.startingBid
    ) {
      setStatusMessage("Please complete all donation fields before submitting.");
      return;
    }

    setItems((prev) => [newItem, ...prev]);
    setSubmission({
      title: "",
      description: "",
      donorFirstName: "",
      donorLastName: "",
      estimatedRetailValue: "",
      startingBid: "",
      image: "",
    });
    setStatusMessage(`Donation submitted: ${newItem.title} has been added to the auction.`);
  }

  function exportWinners() {
    const csv = buildWinnerCsv(items);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "auction-winners.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalBids = items.reduce((sum, item) => sum + item.bids.length, 0);
  const totalValue = items.reduce((sum, item) => sum + getHighestBid(item).amount, 0);

  if (!checkedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Desert Ridge Ward Youth Auction Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                value={checkinName}
                onChange={(e) => setCheckinName(e.target.value)}
                placeholder="Enter your name"
                className="rounded-xl"
              />
            </div>
            <p className="text-sm text-slate-500">
              No login required. Once you check in, you will receive an anonymous bidder number that
              auto-populates when you bid.
            </p>
            <Button onClick={handleCheckin} className="w-full rounded-xl">
              Register
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex h-full flex-col justify-between p-8">
              <div>
                <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3">
                  <Gavel className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold">I want to bid</h2>
                <p className="mt-2 text-slate-600">
                  Browse auction items, place bids with your anonymous bidder number, and see whether
                  you are currently winning.
                </p>
              </div>
              <Button onClick={() => chooseMode("bid")} className="mt-6 rounded-xl text-base">
                Continue to Bidding
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-3xl shadow-sm">
            <CardContent className="flex h-full flex-col justify-between p-8">
              <div>
                <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3">
                  <HeartHandshake className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-bold">I want to donate</h2>
                <p className="mt-2 text-slate-600">
                  Submit a good or service for the auction with all the donor and pricing details needed
                  to add it to the catalog.
                </p>
              </div>
              <Button
                onClick={() => chooseMode("donate")}
                variant="outline"
                className="mt-6 rounded-xl text-base"
              >
                Continue to Donation Form
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  Church Youth Silent Auction
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Anonymous bidder numbers, live item list, quick bidding, item listing, checkout, and
                  projector mode.
                </p>
              </div>
              <div className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow-sm">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  <UserRound className="h-4 w-4" /> Your bidder number
                </div>
                <div className="mt-1 text-3xl font-bold tracking-[0.2em]">#{bidderNumber}</div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-slate-500">Items</div>
                <div className="mt-2 text-2xl font-bold">{items.length}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-slate-500">Total bids</div>
                <div className="mt-2 text-2xl font-bold">{totalBids}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-slate-500">Current value</div>
                <div className="mt-2 text-2xl font-bold">{formatCurrency(totalValue)}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {statusMessage && (
          <Alert className="rounded-2xl border-slate-200 bg-white">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="grid w-full max-w-7xl grid-cols-9 rounded-2xl bg-white p-1 shadow-sm">
              <TabsTrigger value="items" className="rounded-xl">
                <Gavel className="mr-2 h-4 w-4" /> Items
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="rounded-xl">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="projector" className="rounded-xl">
                <Projector className="mr-2 h-4 w-4" /> Live Auction Board
              </TabsTrigger>
              <TabsTrigger value="donate" className="rounded-xl">
                <ListPlus className="mr-2 h-4 w-4" /> List Item
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-xl">
                <QrCode className="mr-2 h-4 w-4" /> Register
              </TabsTrigger>
              <button
                type="button"
                onClick={handleAdminTabClick}
                className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              >
                <TabletSmartphone className="mr-2 h-4 w-4" /> ADMIN
              </button>
              <TabsTrigger value="winning" className="rounded-xl">
                <Gavel className="mr-2 h-4 w-4" /> Winning
              </TabsTrigger>
              <TabsTrigger value="outbid" className="rounded-xl">
                <ArrowUpCircle className="mr-2 h-4 w-4" /> Outbid
              </TabsTrigger>
              <TabsTrigger value="checkout" className="rounded-xl">
                <Download className="mr-2 h-4 w-4" /> Checkout
              </TabsTrigger>
            </TabsList>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setBiddingClosed((value) => !value)}
              >
                {biddingClosed ? "Reopen Bidding" : "Close Bidding"}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={exportWinners}>
                <Download className="mr-2 h-4 w-4" /> Export Winners
              </Button>
            </div>
          </div>

          <TabsContent value="items" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search items or services"
                      className="rounded-xl pl-9"
                    />
                  </div>
                  <div className="text-sm text-slate-500">
                    {biddingClosed ? "Bidding is currently closed." : "Bidding is currently open."}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const highest = getHighestBid(item);
                const isWinning =
                  highest.bidderNumber !== "—" && String(highest.bidderNumber) === String(bidderNumber);
                const hasBidOnItem = item.bids.some(
                  (bid) => String(bid.bidderNumber) === String(bidderNumber)
                );
                const isOutbid = hasBidOnItem && !isWinning;

                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden rounded-2xl shadow-sm transition hover:shadow-md"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    </div>
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-xl leading-tight">{item.title}</CardTitle>
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                          {item.bids.length ? `${item.bids.length} bids` : "No bids yet"}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{item.description}</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-slate-100 p-3">
                          <div className="text-slate-500">Current highest</div>
                          <div className="mt-1 text-lg font-semibold">{formatCurrency(highest.amount)}</div>
                        </div>
                        <div className="rounded-xl bg-slate-100 p-3">
                          <div className="text-slate-500">Leading bidder</div>
                          <div className="mt-1 text-lg font-semibold">
                            {highest.bidderNumber === "—" ? "—" : `#${highest.bidderNumber}`}
                          </div>
                        </div>
                      </div>

                      {isWinning && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                          You are currently winning this item.
                        </div>
                      )}

                      {isOutbid && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                          You have been outbid on this item.
                        </div>
                      )}

                      <Button
                        onClick={() => openBid(item)}
                        disabled={biddingClosed}
                        className="w-full rounded-xl py-6 text-base"
                      >
                        Place Bid
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="dashboard">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Highest bid dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-separate border-spacing-y-2 text-left">
                    <thead>
                      <tr className="text-sm text-slate-500">
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2">Retail Value</th>
                        <th className="px-4 py-2">Starting Bid</th>
                        <th className="px-4 py-2">Highest Bid</th>
                        <th className="px-4 py-2">Highest Bidder #</th>
                        <th className="px-4 py-2">Bid Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .slice()
                        .sort((a, b) => a.title.localeCompare(b.title))
                        .map((item) => {
                          const highest = getHighestBid(item);
                          return (
                            <tr key={item.id} className="bg-slate-50 text-sm shadow-sm">
                              <td className="rounded-l-2xl px-4 py-3 font-medium text-slate-900">
                                {item.title}
                              </td>
                              <td className="px-4 py-3">{formatCurrency(item.estimatedRetailValue)}</td>
                              <td className="px-4 py-3">{formatCurrency(item.startingBid)}</td>
                              <td className="px-4 py-3 font-semibold">{formatCurrency(highest.amount)}</td>
                              <td className="px-4 py-3">
                                {highest.bidderNumber === "—" ? "—" : `#${highest.bidderNumber}`}
                              </td>
                              <td className="rounded-r-2xl px-4 py-3">{item.bids.length}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projector">
            <Card className="rounded-3xl border-0 bg-slate-900 text-white shadow-xl">
              <CardContent className="p-8 md:p-10">
                <div className="mb-8 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm uppercase tracking-[0.25em] text-slate-400">
                      Live Auction Board
                    </div>
                    <h2 className="mt-2 text-4xl font-bold">Current Highest Bids</h2>
                    <p className="mt-2 text-slate-400">
                      Auto-refreshes every 10 seconds for projector display.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</div>
                      <div className="mt-1 text-lg font-semibold">{biddingClosed ? "Closed" : "Open"}</div>
                    </div>
                    <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Time Left</div>
                      <div className="mt-1 text-lg font-semibold">
                        {remainingMinutes}:{String(remainingSeconds).padStart(2, "0")}
                      </div>
                    </div>
                  </div>
                </div>

                {isInSoftCloseWindow && (
                  <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-200">
                    Soft-close window is active. Any new bid extends the auction by {softCloseExtensionMinutes} minutes.
                  </div>
                )}

                <div className="space-y-3">
                  {projectorData.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[70px_1.6fr_1fr_1fr] items-center gap-4 rounded-2xl bg-white/5 px-5 py-4"
                    >
                      <div className="text-3xl font-bold text-slate-300">{index + 1}</div>
                      <div>
                        <div className="text-2xl font-semibold">{item.title}</div>
                        <div className="text-sm text-slate-400">
                          Starting at {formatCurrency(item.startingBid)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-400">High Bid</div>
                        <div className="text-3xl font-bold">{formatCurrency(item.highest.amount)}</div>
                      </div>
                      <div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-400">Bidder #</div>
                        <div className="text-3xl font-bold">
                          {item.highest.bidderNumber === "—" ? "—" : `#${item.highest.bidderNumber}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="donate">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>List an Item or Service</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDonationSubmit} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Item name</Label>
                    <Input
                      value={submission.title}
                      onChange={(e) => setSubmission((prev) => ({ ...prev, title: e.target.value }))}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={submission.description}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="min-h-[130px] rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Donor first name</Label>
                    <Input
                      value={submission.donorFirstName}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, donorFirstName: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Donor last name</Label>
                    <Input
                      value={submission.donorLastName}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, donorLastName: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estimated retail value</Label>
                    <Input
                      type="number"
                      min="1"
                      value={submission.estimatedRetailValue}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, estimatedRetailValue: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Starting bid</Label>
                    <Input
                      type="number"
                      min="1"
                      value={submission.startingBid}
                      onChange={(e) =>
                        setSubmission((prev) => ({ ...prev, startingBid: e.target.value }))
                      }
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Upload item photo (optional)</Label>
                    <div className="flex flex-col gap-3">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => handleImageUpload(e.target.files?.[0])}
                        className="rounded-xl"
                      />
                      <Input
                        placeholder="Or paste an image URL"
                        value={submission.image}
                        onChange={(e) => setSubmission((prev) => ({ ...prev, image: e.target.value }))}
                        className="rounded-xl"
                      />
                      <p className="text-xs text-slate-500">
                        You can upload a photo, take one with your camera, or paste a URL.
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" className="rounded-xl px-8">
                      Submit Donation
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>QR Code Registration</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-[280px_1fr] md:items-center">
                <div className="flex aspect-square items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50">
                  <div className="text-center text-slate-500">
                    <QrCode className="mx-auto mb-3 h-20 w-20" />
                    <div className="font-semibold">QR Placeholder</div>
                    <div className="text-sm">Point this to your live check-in page</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-slate-600">
                    Print this page or display it at the event entrance so guests can scan the code,
                    open the site, and register for an anonymous bidder number.
                  </p>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-sm text-slate-500">Registration URL</div>
                    <div className="mt-1 break-all font-medium">{registrationUrl}</div>
                  </div>
                  <p className="text-sm text-slate-500">
                    In the live version, this QR should be generated from your real deployment URL.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Admin Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-slate-600">
                  Use this on a leader&apos;s tablet to help members who want assistance. Enter their bidder
                  number, then open any item and place bids on their behalf.
                </p>
                <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-end">
                  <div className="space-y-2">
                    <Label>Active bidder number</Label>
                    <Input
                      value={tabletBidderNumber}
                      onChange={(e) =>
                        setTabletBidderNumber(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="Enter bidder #"
                      className="rounded-xl text-lg"
                    />
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    When a bidder number is entered here, bids submitted from the bid modal will use that
                    number instead of the current device&apos;s number.
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <TimerReset className="h-4 w-4" /> Auction Timing
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs uppercase text-slate-500">Time Remaining</div>
                      <div className="mt-1 text-xl font-bold">
                        {remainingMinutes}:{String(remainingSeconds).padStart(2, "0")}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs uppercase text-slate-500">Soft-Close Window</div>
                      <div className="mt-1 text-xl font-bold">{softCloseWindowMinutes} min</div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="text-xs uppercase text-slate-500">Extension</div>
                      <div className="mt-1 text-xl font-bold">+{softCloseExtensionMinutes} min</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="winning">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Items You&apos;re Winning</CardTitle>
              </CardHeader>
              <CardContent>
                {winningItems.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-slate-600">
                    You are not currently winning any items.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {winningItems.map((item) => (
                      <Card key={item.id} className="overflow-hidden rounded-2xl shadow-sm">
                        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <CardContent className="space-y-3 p-5">
                          <div className="text-lg font-semibold">{item.title}</div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                            You are currently winning this item.
                          </div>
                          <div className="text-sm text-slate-600">
                            Current bid: <span className="font-semibold">{formatCurrency(item.highest.amount)}</span>
                          </div>
                          <Button
                            onClick={() => openBid(item)}
                            disabled={biddingClosed}
                            className="w-full rounded-xl"
                          >
                            Raise My Bid
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="outbid">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Items You&apos;ve Been Outbid On</CardTitle>
              </CardHeader>
              <CardContent>
                {outbidItems.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-slate-600">
                    You have not been outbid on any items.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {outbidItems.map((item) => (
                      <Card key={item.id} className="overflow-hidden rounded-2xl shadow-sm">
                        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200">
                          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                        </div>
                        <CardContent className="space-y-3 p-5">
                          <div className="text-lg font-semibold">{item.title}</div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                            You have been outbid on this item.
                          </div>
                          <div className="text-sm text-slate-600">
                            Current bid: <span className="font-semibold">{formatCurrency(item.highest.amount)}</span>
                          </div>
                          <Button
                            onClick={() => openBid(item)}
                            disabled={biddingClosed}
                            className="w-full rounded-xl"
                          >
                            Bid Again
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checkout">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle>Auction Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {!biddingClosed ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                    Checkout will appear automatically after the auction is closed.
                  </div>
                ) : checkoutItems.length === 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-5 text-slate-600">
                      No winning items were found for bidder #{bidderNumber}.
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-sm text-slate-500">Bidder Number</div>
                      <div className="mt-1 text-2xl font-bold">#{bidderNumber}</div>
                      <div className="mt-3 text-sm text-slate-500">Total Due</div>
                      <div className="mt-1 text-3xl font-bold">$0</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-sm text-slate-500">Bidder Number</div>
                        <div className="mt-1 text-3xl font-bold">#{bidderNumber}</div>
                        <div className="mt-4 text-sm text-slate-500">Items Won</div>
                        <div className="mt-1 text-2xl font-bold">{checkoutItems.length}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-900 p-5 text-white">
                        <div className="text-sm text-slate-300">Total Due</div>
                        <div className="mt-2 text-4xl font-bold">{formatCurrency(checkoutTotal)}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full min-w-[700px] text-left">
                        <thead className="bg-slate-50 text-sm text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Item</th>
                            <th className="px-4 py-3">Winning Bid</th>
                            <th className="px-4 py-3">Bidder #</th>
                            <th className="px-4 py-3">Donor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkoutItems.map((item) => (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="px-4 py-3 font-medium text-slate-900">{item.title}</td>
                              <td className="px-4 py-3">{formatCurrency(item.highest.amount)}</td>
                              <td className="px-4 py-3">#{item.highest.bidderNumber}</td>
                              <td className="px-4 py-3">
                                {item.donorFirstName} {item.donorLastName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="rounded-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Place a bid</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <form onSubmit={placeBid} className="space-y-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Item</div>
                  <div className="text-lg font-semibold">{selectedItem.title}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bidder number</Label>
                    <Input
                      value={`#${tabletBidderNumber || bidderNumber || ""}`}
                      readOnly
                      className="rounded-xl bg-slate-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current highest</Label>
                    <Input
                      value={formatCurrency(getHighestBid(selectedItem).amount)}
                      readOnly
                      className="rounded-xl bg-slate-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Your bid amount</Label>
                  <Input
                    type="number"
                    min={getHighestBid(selectedItem).amount + 1}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="rounded-xl text-lg"
                  />
                  <p className="text-xs text-slate-500">
                    Bid must be at least {formatCurrency(getHighestBid(selectedItem).amount + 1)}.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[1, 5, 10].map((increment) => (
                    <Button
                      key={increment}
                      type="button"
                      variant="outline"
                      className="rounded-xl py-6 text-base"
                      onClick={() => applyIncrement(increment)}
                    >
                      <ArrowUpCircle className="mr-2 h-4 w-4" /> +{increment}
                    </Button>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setSelectedItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-xl px-6 py-6 text-base">
                    Submit Bid
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
