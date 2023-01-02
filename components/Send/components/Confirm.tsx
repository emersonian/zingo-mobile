/* eslint-disable react-native/no-inline-styles */
import React, { useContext } from 'react';
import { View, ScrollView, SafeAreaView } from 'react-native';

import FadeText from '../../Components/FadeText';
import BoldText from '../../Components/BoldText';
import RegText from '../../Components/RegText';
import ZecAmount from '../../Components/ZecAmount';
import UsdAmount from '../../Components/UsdAmount';
import Button from '../../Button';
import { useTheme } from '@react-navigation/native';
import Utils from '../../../app/utils';
import { ContextLoaded } from '../../../app/context';

type ConfirmProps = {
  defaultFee: number;
  closeModal: () => void;
  confirmSend: () => void;
};
const Confirm: React.FunctionComponent<ConfirmProps> = ({ closeModal, confirmSend, defaultFee }) => {
  const context = useContext(ContextLoaded);
  const { sendPageState, info, translate } = context;
  const { colors } = useTheme();

  const sendingTotal = Number(sendPageState.toaddr.amount) + defaultFee;

  //console.log(sendPageState, price, defaultFee);

  return (
    <SafeAreaView
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        height: '100%',
        backgroundColor: colors.background,
      }}>
      <ScrollView contentContainerStyle={{ display: 'flex', justifyContent: 'flex-start' }}>
        <View style={{ display: 'flex', alignItems: 'center', padding: 10, backgroundColor: colors.card }}>
          <BoldText style={{ textAlign: 'center', margin: 10 }}>{translate('send.confirm-title')}</BoldText>
        </View>

        <View
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: 25,
            padding: 10,
            borderWidth: 1,
            borderRadius: 10,
            borderColor: colors.border,
          }}>
          <BoldText style={{ textAlign: 'center' }}>{translate('send.sending-title')}</BoldText>

          <ZecAmount currencyName={info.currencyName ? info.currencyName : ''} amtZec={sendingTotal} />
          <UsdAmount amtZec={sendingTotal} price={info.zecPrice} />
        </View>
        {[sendPageState.toaddr].map(to => {
          return (
            <View key={to.id} style={{ margin: 10 }}>
              <FadeText>{translate('send.to')}</FadeText>
              <RegText>{Utils.splitStringIntoChunks(to.to, 8).join(' ')}</RegText>

              <FadeText style={{ marginTop: 10 }}>{translate('send.confirm-amount')}</FadeText>
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: 5,
                }}>
                <ZecAmount
                  currencyName={info.currencyName ? info.currencyName : ''}
                  size={18}
                  amtZec={Number(to.amount)}
                />
                <UsdAmount style={{ fontSize: 18 }} amtZec={Number(to.amount)} price={info.zecPrice} />
              </View>
              <RegText>{to.memo || ''}</RegText>
            </View>
          );
        })}

        <View style={{ margin: 10, marginBottom: 30 }}>
          <FadeText>{translate('send.fee')}</FadeText>
          <View
            style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <ZecAmount currencyName={info.currencyName ? info.currencyName : ''} size={18} amtZec={defaultFee} />
            <UsdAmount style={{ fontSize: 18 }} amtZec={defaultFee} price={info.zecPrice} />
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          marginTop: 10,
        }}>
        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <Button type="Primary" title={translate('send.confirm-button')} onPress={confirmSend} />
          <Button type="Secondary" style={{ marginLeft: 20 }} title={translate('cancel')} onPress={closeModal} />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Confirm;