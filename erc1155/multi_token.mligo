type tx = {
  token_id : nat; (* ID of the token type *)
  amount : nat;   (* Transfer amount *)
}

type transfer_param = {
  (* Source address *)
  from_ : address;
  (* 
    Target address. Target smart contract must implement entry points from
    `multi_token_receiver` interface
  *)
  to_ : address;
  (* Batch of tokens and their amounts to be transferred *)
  batch : tx list;
  (* 
    Additional data with no specified format, MUST be sent unaltered in call to
    `On_multi_tokens_received` on `to_` contract.
  *)
  data : bytes;
}

type balance_request = {
  owner : address; (* The address of the token holder *)
  token_id : nat;  (* ID of the  token *)
}

type balance_of_param = {
  balance_request : balance_request list;
  balance_view : ((balance_request * nat) list) -> operation;
}

type set_approval_for_all_param = {
  (* Address to add or remove from the set of authorized operators for sender *)
  operator : address;
  (* True if the operator is approved, false to revoke approval *)
  approved : bool;
}

type is_operator_request = {
  owner : address;    (* The owner of the tokens *)
  operator : address; (* Address of authorized operator *)
}
type is_operator_param = {
  is_operator_request : is_operator_request;
  is_operator_view : (is_operator_request * bool) -> operation
}

(* `multi-token` entry points *)
type multi_token =
  (*
    Transfers specified `amount`(s) of `token_id`(s) from the `from` address to
    the `to_` address specified (with safety call).
    Caller must be approved to manage the tokens being transferred out of the
    `from` account (see "Approval" section of the standard).
    MUST revert if any of the balance(s) of the holder(s) for token(s) is lower
    than the respective amount(s) in amounts sent to the recipient.
    MUST call `On_multi_tokens_received` hook defined by `multi_token_receiver`
    on `to_` and act appropriately (see "Safe Transfer Rules" section of the
    standard).
    If `to_` contract does not implement `multi_token_receiver` interface,
    the transaction must fail.
  *)
  | Transfer of transfer_param
  (* Get the balance of multiple account/token pairs *)
  | Balance_of of balance_of_param
  (*
    Enable or disable approval for a third party ("operator") to manage all of
    the caller's tokens.
  *)
  | Set_approval_for_all of set_approval_for_all_param
  (* Queries the approval status of an operator for a given owner. *)
  | Is_operator of is_operator_param

type on_multi_tokens_received_param = {
  operator : address;     (* The address which initiated the transfer (i. e. sender) *)
  from_ : address option; (* Source address. None for minting operation *)
  batch : tx list;        (* Batch of tokens and their amounts which are transferred *)
  data : bytes;           (* Additional data with no specified format *)
}

(* multi_token_receiver entry points *)
type multi_token_receiver =
  (*
    Handle the receipt of multiple token types.
    A  multi-asset compliant smart contract MUST call this function on the token
    recipient contract from a `Transfer`.
    MUST revert if it rejects the transfer(s).
  *)
  | On_multi_tokens_received of on_multi_tokens_received_param
