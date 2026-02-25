import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  BarChart3,
  BatteryCharging,
  Bot,
  FileText,
  TrendingUp,
  Zap,
} from "lucide-react";
import HowItWorksDemo from "@/components/HowItWorksDemo";
import PricingSection from "@/components/PricingSection";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* NAV */}
      <nav className="fixed top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-cyan-400" />
            <span className="text-lg font-bold tracking-tight">NodalIQ</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-cyan-500 text-black hover:bg-cyan-400 font-semibold">
                Get Early Access
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-40 text-center">
        <Badge className="mb-6 border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/10">
          ERCOT · Behind-the-Meter · Grid-Scale BESS
        </Badge>
        <h1 className="mb-6 max-w-4xl text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
          Your Battery.{" "}
          <span className="text-cyan-400">Smarter</span> Every Day.
        </h1>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400">
          NodalIQ is an AI dispatch intelligence platform that analyzes real
          ERCOT nodal prices, forecasts tomorrow&apos;s market, and delivers a
          plain-language recommendation — before 6 AM, every morning.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Link href="/sign-up">
            <Button size="lg" className="bg-cyan-500 px-8 text-black hover:bg-cyan-400 font-semibold">
              Start Free Trial
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button size="lg" variant="outline" className="border-zinc-700 px-8 text-zinc-300 hover:border-zinc-500 hover:text-white bg-transparent">
              See Live Demo
            </Button>
          </a>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px md:grid-cols-4">
          {[
            { value: "$175", label: "Avg daily arbitrage identified" },
            { value: "Top 10%", label: "Revenue vs. flat schedule" },
            { value: "24h", label: "Dispatch forecast horizon" },
            { value: "<200ms", label: "LP optimizer solve time" },
          ].map((stat) => (
            <div key={stat.label} className="px-8 py-8 text-center">
              <div className="mb-1 text-3xl font-bold text-cyan-400">{stat.value}</div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <Badge className="mb-4 border-zinc-700 bg-zinc-800 text-zinc-400">Platform Features</Badge>
          <h2 className="text-4xl font-bold tracking-tight">Intelligence at every layer</h2>
          <p className="mt-4 text-zinc-400">From raw market data to actionable dispatch schedules — fully automated.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <Activity className="h-5 w-5 text-cyan-400" />,
              title: "Live ERCOT Data Pipeline",
              description: "Real-time and day-ahead LMP prices fetched and stored automatically across all four hub nodes. Your decisions are always grounded in actual market conditions.",
            },
            {
              icon: <TrendingUp className="h-5 w-5 text-cyan-400" />,
              title: "ML Price Forecasting",
              description: "A Prophet time-series model trained on historical nodal prices predicts tomorrow's peaks and valleys. Forecast confidence intervals shown on every chart.",
            },
            {
              icon: <BarChart3 className="h-5 w-5 text-cyan-400" />,
              title: "LP + RL Dual Optimizer",
              description: "A linear program finds the mathematically optimal schedule. A parallel SAC reinforcement learning policy provides a robustness check. Both run every time.",
            },
            {
              icon: <Bot className="h-5 w-5 text-cyan-400" />,
              title: "Agentic Daily Briefing",
              description: "A LangGraph agent pulls market data, runs both optimizers, selects the better strategy, and writes a plain-language recommendation — delivered to your dashboard.",
            },
            {
              icon: <FileText className="h-5 w-5 text-cyan-400" />,
              title: "Chat with Your Data",
              description: "Upload tariff schedules, utility bills, or interconnection agreements. Ask questions in plain English. Get answers grounded in your actual documents via RAG.",
            },
            {
              icon: <BatteryCharging className="h-5 w-5 text-cyan-400" />,
              title: "Intelligence Report",
              description: "One click generates a full pipeline report: raw prices, forecast curve, dispatch schedule, hourly economics table, ERCOT node map, and LP vs SAC comparison.",
            },
          ].map((feature) => (
            <Card key={feature.title} className="border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors">
              <CardContent className="p-6">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800">
                  {feature.icon}
                </div>
                <h3 className="mb-2 font-semibold text-white">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="bg-zinc-800" />

      {/* HOW IT WORKS — interactive demo */}
      <HowItWorksDemo />

      <Separator className="bg-zinc-800" />

      {/* PRICING — with monthly/annual toggle */}
      <PricingSection />

      {/* FINAL CTA */}
      <section className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <Zap className="mb-6 h-10 w-10 text-cyan-400" />
          <h2 className="mb-4 text-4xl font-bold tracking-tight">Stop dispatching blind.</h2>
          <p className="mb-10 text-lg text-zinc-400">
            Join operators who let AI handle the market analysis so they can focus on running assets.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-cyan-500 px-10 text-black hover:bg-cyan-400 font-semibold">
              Get Early Access — It&apos;s Free
            </Button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500 md:flex-row">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            <span className="font-semibold text-zinc-300">NodalIQ</span>
          </div>
          <span>© 2026 NodalIQ. Battery dispatch intelligence for serious operators.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
