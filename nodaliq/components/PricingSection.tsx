"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    monthly: 0,
    description: "Explore ERCOT prices and run basic simulations.",
    features: [
      "3 agent runs per month",
      "1 battery profile",
      "HB_NORTH node only",
      "7-day price history",
      "Basic dispatch chart",
    ],
    excluded: ["ML price forecasting", "RAG document chat", "Performance tracker", "Intelligence Report"],
    cta: "Start Free",
    href: "/sign-up",
    highlight: false,
  },
  {
    name: "Pro",
    monthly: 299,
    description: "Full AI dispatch intelligence for active BESS operators.",
    features: [
      "Unlimited agent runs",
      "5 battery profiles",
      "All 4 ERCOT hub nodes",
      "Prophet ML price forecast",
      "LP + SAC RL optimizer",
      "Daily AI briefing agent",
      "RAG document chat",
      "Performance P&L tracker",
      "Intelligence Report export",
      "PDF schedule download",
    ],
    excluded: [],
    cta: "Start 14-Day Trial",
    href: "/sign-up",
    highlight: true,
  },
  {
    name: "Enterprise",
    monthly: null,
    description: "Multi-site portfolios and API access for EPC firms.",
    features: [
      "Everything in Pro",
      "Unlimited battery profiles",
      "Custom ERCOT nodes",
      "REST API access",
      "Multi-site portfolio view",
      "Custom tariff upload",
      "Dedicated onboarding",
      "SLA + priority support",
    ],
    excluded: [],
    cta: "Contact Us",
    href: "mailto:hello@nodaliq.ai",
    highlight: false,
  },
];

export default function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-12 text-center">
        <Badge className="mb-4 border-zinc-700 bg-zinc-800 text-zinc-400">
          Pricing
        </Badge>
        <h2 className="text-4xl font-bold tracking-tight text-white">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-zinc-400">
          Start free. Upgrade when your battery earns more than it costs.
        </p>

        {/* Toggle */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-zinc-700 bg-zinc-900 p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !annual ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              annual ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            Annual
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-xs text-cyan-400">
              −20%
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price =
            plan.monthly === null
              ? "Custom"
              : plan.monthly === 0
              ? "$0"
              : annual
              ? `$${Math.round(plan.monthly * 0.8)}`
              : `$${plan.monthly}`;

          const period =
            plan.monthly === null
              ? "contact us"
              : plan.monthly === 0
              ? "forever"
              : annual
              ? "per month, billed annually"
              : "per month";

          return (
            <Card
              key={plan.name}
              className={`relative flex flex-col border-zinc-800 transition-colors ${
                plan.highlight
                  ? "border-cyan-500/50 bg-zinc-900 ring-1 ring-cyan-500/20"
                  : "bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-0 right-0 flex justify-center">
                  <Badge className="border-cyan-500/30 bg-cyan-500 text-black text-xs font-semibold px-3">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardContent className="flex flex-1 flex-col p-6 pt-7">
                <div className="mb-1 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                  {plan.name}
                </div>
                <div className="mb-0.5 text-4xl font-bold text-white">{price}</div>
                <div className="mb-4 text-xs text-zinc-500">{period}</div>
                <p className="mb-6 text-sm text-zinc-400">{plan.description}</p>

                <ul className="mb-8 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
                      {f}
                    </li>
                  ))}
                  {plan.excluded.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-zinc-600 line-through">
                      <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-center text-zinc-700">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href={plan.href}>
                  <Button
                    className={`w-full font-semibold ${
                      plan.highlight
                        ? "bg-cyan-500 text-black hover:bg-cyan-400"
                        : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500 hover:text-white"
                    }`}
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-zinc-600">
        No credit card required for Free tier · Cancel Pro anytime · Enterprise pricing based on asset count
      </p>
    </section>
  );
}
