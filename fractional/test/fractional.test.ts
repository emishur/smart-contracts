import { $log } from '@tsed/logger';
import { BigNumber } from 'bignumber.js';
import { TezosToolkit } from '@taquito/taquito';

import { bootstrap, TestTz } from 'smart-contracts-common/bootstrap-sandbox';
import { Contract, address, nat } from 'smart-contracts-common/type-aliases';
import { defaultLigoEnv } from 'smart-contracts-common/ligo';
import { originateNftCollection, originateFractionalDao } from './origination';
import {
  queryBalances,
  hasNftTokens
} from 'smart-contracts-common/fa2-balance-inspector';
import { transfer } from 'smart-contracts-common/fa2-interface';

jest.setTimeout(240000);

const ligoEnv = defaultLigoEnv('../../', '../ligo');

describe('fractional ownership test', () => {
  let tezos: TestTz;
  let nftFa2: Contract;
  let fractionalDao: Contract;

  beforeAll(async () => {
    tezos = await bootstrap();
  });

  beforeEach(async () => {
    nftFa2 = await originateNftCollection(ligoEnv, tezos.bob);
    fractionalDao = await originateFractionalDao(ligoEnv, tezos.bob);
  });

  async function assertHasNft(owner: address, token_id: nat): Promise<void> {
    const [hasIt] = await hasNftTokens(
      nftFa2,
      [{ owner, token_id }],
      tezos.lambdaView
    );
    expect(hasIt).toBe(true);
  }

  async function transferNFT(
    tz: TezosToolkit,
    token_id: nat,
    from_: address,
    to_: address
  ): Promise<void> {
    await transfer(nftFa2.address, tz, [
      {
        from_,
        txs: [{ to_, token_id, amount: new BigNumber(1) }]
      }
    ]);
  }

  async function bobTransfersNftToDao(nftTokenId: nat): Promise<void> {
    const bobAddress = await tezos.bob.signer.publicKeyHash();
    const aliceAddress = await tezos.alice.signer.publicKeyHash();

    await assertHasNft(bobAddress, nftTokenId);
    $log.info('bob owns the NFT');

    await transferNFT(tezos.bob, nftTokenId, bobAddress, fractionalDao.address);
    await assertHasNft(fractionalDao.address, nftTokenId);
    $log.info('DAO owns the NFT');

    const ownershipOp = await fractionalDao.methods
      .set_ownership(
        nftFa2.address,
        nftTokenId,
        [
          { owner: bobAddress, amount: 50 },
          { owner: aliceAddress, amount: 50 }
        ],
        75, //voting_threshold
        10000000 // voting_period
      )
      .send({ source: bobAddress });
    await ownershipOp.confirmation();
    $log.info('DAO ownership parameters are set');
  }

  async function voteTransferFromDao(
    tz: TezosToolkit,
    to_: address,
    nftFa2: address,
    nftTokenId: nat
  ): Promise<void> {
    const dao = await tz.contract.at(fractionalDao.address);
    const voteOp = await dao.methods
      .vote_transfer(to_, nftFa2, nftTokenId)
      .send();
    await voteOp.confirmation();
    $log.info(`Vote consumed gas ${voteOp.consumedGas}`);
  }

  test('direct transfer', async () => {
    const aliceAddress = await tezos.alice.signer.publicKeyHash();
    const tokenId = new BigNumber(1);
    await bobTransfersNftToDao(tokenId);

    await voteTransferFromDao(tezos.bob, aliceAddress, nftFa2.address, tokenId);
    await assertHasNft(fractionalDao.address, tokenId);
    $log.info('Bob voted.');

    await voteTransferFromDao(
      tezos.alice,
      aliceAddress,
      nftFa2.address,
      tokenId
    );
    $log.info('Alice voted.');

    await assertHasNft(aliceAddress, tokenId);
    $log.info('NFT is transferred from DAO to Alice');
  });
});