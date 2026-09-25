import { FormEvent, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function YapayZeka() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Merhaba. RMA kayıtları, servis süreçleri ve operasyon hakkında nasıl yardımcı olabilirim?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const response = await apiRequest("POST", "/api/ai/chat", {
        messages: nextMessages,
      });
      const data = (await response.json()) as { message: string };
      setMessages([...nextMessages, { role: "assistant", content: data.message }]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Yanıt alınamadı.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-col bg-muted/20">
      <div className="border-b bg-background p-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Yapay Zeka Asistanı</h1>
            <p className="text-sm text-muted-foreground">RMA operasyonları için Türkçe destek</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "assistant" && (
                <div className="mt-1 rounded-md bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div>
              )}
              <Card className={`max-w-[85%] ${message.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                <CardContent className="whitespace-pre-wrap p-3 text-sm">{message.content}</CardContent>
              </Card>
              {message.role === "user" && (
                <div className="mt-1 rounded-md bg-muted p-2"><User className="h-4 w-4" /></div>
              )}
            </div>
          ))}
          {isSending && <p className="text-sm text-muted-foreground">Asistan yanıt hazırlıyor...</p>}
        </div>
      </div>

      <div className="border-t bg-background p-4">
        <form onSubmit={sendMessage} className="mx-auto flex max-w-4xl items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Sorunuzu yazın..."
            rows={2}
            maxLength={8000}
            disabled={isSending}
            className="resize-none"
          />
          <Button type="submit" size="icon" disabled={isSending || !input.trim()} aria-label="Mesaj gönder">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}