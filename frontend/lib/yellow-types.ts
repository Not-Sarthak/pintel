export type OrderMessage =
  | {
      type: "ask";
      positionId: number;
      price: string;
      mu: number;
      sigma: number;
      collateral: string;
      from: string;
      ts: number;
    }
  | { type: "cancel_ask"; positionId: number; from: string; ts: number }
  | {
      type: "fill";
      positionId: number;
      price: string;
      buyer: string;
      seller: string;
      ts: number;
    }
  | { type: "chat"; text: string; from: string; ts: number }
  | { type: "heartbeat"; from: string; ts: number }
  | {
      type: "sync";
      from: string;
      ts: number;
      asks: AskOrder[];
      chat: ChatMessage[];
      market: string;
    };

export interface AskOrder {
  positionId: number;
  price: string;
  mu: number;
  sigma: number;
  collateral: string;
  from: string;
  ts: number;
}

export interface FillEvent {
  positionId: number;
  price: string;
  buyer: string;
  seller: string;
  ts: number;
}

export interface ChatMessage {
  text: string;
  from: string;
  ts: number;
}
