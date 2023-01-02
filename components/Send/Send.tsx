/* eslint-disable react-native/no-inline-styles */
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { View, ScrollView, Modal, Image, Alert, Keyboard, TextInput, TouchableOpacity } from 'react-native';
import { faQrcode, faCheck, faInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { useTheme } from '@react-navigation/native';
import Toast from 'react-native-simple-toast';
import { getNumberFormatSettings } from 'react-native-localize';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import Animated, { EasingNode } from 'react-native-reanimated';

import FadeText from '../Components/FadeText';
import ErrorText from '../Components/ErrorText';
import RegText from '../Components/RegText';
import ZecAmount from '../Components/ZecAmount';
import UsdAmount from '../Components/UsdAmount';
import Button from '../Button';
import { SendPageStateClass, SendProgressClass, ToAddrClass } from '../../app/AppState';
import { parseZcashURI, ZcashURITarget } from '../../app/uris';
import RPCModule from '../RPCModule';
import Utils from '../../app/utils';
import Scanner from './components/Scanner';
import Confirm from './components/Confirm';
import { ThemeType } from '../../app/types';
import { ContextLoaded } from '../../app/context';

type SendProps = {
  setSendPageState: (sendPageState: SendPageStateClass) => void;
  sendTransaction: (setSendProgress: (arg0: SendProgressClass) => void) => Promise<String>;
  clearToAddr: () => void;
  setSendProgress: (progress: SendProgressClass) => void;
  toggleMenuDrawer: () => void;
  setComputingModalVisible: (visible: boolean) => void;
  syncingStatusMoreInfoOnClick: () => void;
  poolsMoreInfoOnClick: () => void;
};

const Send: React.FunctionComponent<SendProps> = ({
  setSendPageState,
  sendTransaction,
  clearToAddr,
  setSendProgress,
  toggleMenuDrawer,
  setComputingModalVisible,
  syncingStatusMoreInfoOnClick,
  poolsMoreInfoOnClick,
}) => {
  const context = useContext(ContextLoaded);
  const { translate, dimensions, info, totalBalance, sendPageState, syncingStatus, navigation } = context;
  const { colors } = useTheme() as unknown as ThemeType;
  const [qrcodeModalVisble, setQrcodeModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [titleViewHeight, setTitleViewHeight] = useState(0);
  const [memoEnabled, setMemoEnabled] = useState(false);
  const [validAddress, setValidAddress] = useState(0); // 1 - OK, 0 - Empty, -1 - KO
  const [validAmount, setValidAmount] = useState(0); // 1 - OK, 0 - Empty, -1 - KO
  const [sendButtonEnabled, setSendButtonEnabled] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const defaultFee = info.defaultFee || Utils.getFallbackDefaultFee();
  const { decimalSeparator } = getNumberFormatSettings();
  const syncStatusDisplayLine = syncingStatus.inProgress ? `(${syncingStatus.blocks})` : '';
  const spendable = totalBalance.transparentBal + totalBalance.spendablePrivate + totalBalance.spendableOrchard;
  const stillConfirming = spendable !== totalBalance.total;

  const getMaxAmount = useCallback((): number => {
    let max = spendable - defaultFee;
    if (max < 0) {
      return 0;
    }
    return max;
  }, [spendable, defaultFee]);

  useEffect(() => {
    const getMemoEnabled = async (address: string): Promise<boolean> => {
      const result = await RPCModule.execute('parse', address);
      const resultJSON = await JSON.parse(result);

      //console.log('parse-memo', address, resultJSON);

      return (
        resultJSON.status === 'success' &&
        resultJSON.address_kind !== 'transparent' &&
        ((!!info.currencyName &&
          info.currencyName === 'ZEC' &&
          (resultJSON.chain_name.toLowerCase() === 'main' || resultJSON.chain_name.toLowerCase() === 'mainnet')) ||
          (!!info.currencyName &&
            info.currencyName !== 'ZEC' &&
            (resultJSON.chain_name.toLowerCase() === 'test' ||
              resultJSON.chain_name.toLowerCase() === 'testnet' ||
              resultJSON.chain_name.toLowerCase() === 'regtest')))
      );
    };

    const address = sendPageState.toaddr.to;

    if (address) {
      getMemoEnabled(address).then(r => {
        setMemoEnabled(r);
      });
    } else {
      setMemoEnabled(false);
    }
  }, [sendPageState.toaddr, sendPageState.toaddr.to, info.currencyName]);

  useEffect(() => {
    const parseAdressJSON = async (address: string): Promise<boolean> => {
      const result = await RPCModule.execute('parse', address);
      const resultJSON = await JSON.parse(result);

      //console.log('parse-address', address, resultJSON.status === 'success');

      return (
        resultJSON.status === 'success' &&
        ((!!info.currencyName &&
          info.currencyName === 'ZEC' &&
          (resultJSON.chain_name.toLowerCase() === 'main' || resultJSON.chain_name.toLowerCase() === 'mainnet')) ||
          (!!info.currencyName &&
            info.currencyName !== 'ZEC' &&
            (resultJSON.chain_name.toLowerCase() === 'test' ||
              resultJSON.chain_name.toLowerCase() === 'testnet' ||
              resultJSON.chain_name.toLowerCase() === 'regtest')))
      );
    };

    var to = sendPageState.toaddr;

    if (to.to) {
      parseAdressJSON(to.to).then(r => {
        setValidAddress(r ? 1 : -1);
      });
    } else {
      setValidAddress(0);
    }

    to.amount = to.amount.replace(decimalSeparator, '.');
    to.amountUSD = to.amountUSD.replace(decimalSeparator, '.');

    let invalid = false;
    if (to.amountUSD !== '') {
      if (isNaN(Number(to.amountUSD))) {
        setValidAmount(-1);
        invalid = true;
      }
    }
    if (!invalid) {
      if (to.amount !== '') {
        if (isNaN(Number(to.amount))) {
          setValidAmount(-1);
        } else {
          if (
            Utils.parseLocaleFloat(Number(to.amount).toFixed(8)) >= 0 &&
            Utils.parseLocaleFloat(Number(to.amount).toFixed(8)) <= Utils.parseLocaleFloat(getMaxAmount().toFixed(8))
          ) {
            setValidAmount(1);
          } else {
            setValidAmount(-1);
          }
        }
      } else {
        setValidAmount(0);
      }
    }
  }, [
    sendPageState.toaddr,
    sendPageState.toaddr.to,
    sendPageState.toaddr.amount,
    sendPageState.toaddr.amountUSD,
    getMaxAmount,
    decimalSeparator,
    info.currencyName,
  ]);

  useEffect(() => {
    setSendButtonEnabled(validAddress === 1 && validAmount === 1);
  }, [validAddress, validAmount]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      Animated.timing(slideAnim, {
        toValue: 0 - titleViewHeight + 25,
        duration: 100,
        easing: EasingNode.linear,
        //useNativeDriver: true,
      }).start();
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 100,
        easing: EasingNode.linear,
        //useNativeDriver: true,
      }).start();
    });

    return () => {
      !!keyboardDidShowListener && keyboardDidShowListener.remove();
      !!keyboardDidHideListener && keyboardDidHideListener.remove();
    };
  }, [slideAnim, titleViewHeight]);

  const updateToField = async (
    address: string | null,
    amount: string | null,
    amountUSD: string | null,
    memo: string | null,
  ) => {
    // Create the new state object
    const newState = new SendPageStateClass(new ToAddrClass(0));

    const newToAddr = sendPageState.toaddr;
    // Find the correct toAddr
    const toAddr = newToAddr;

    if (address !== null) {
      // Attempt to parse as URI if it starts with zcash
      if (address.startsWith('zcash:')) {
        const target: string | ZcashURITarget = await parseZcashURI(address);
        //console.log(targets);

        if (typeof target !== 'string') {
          // redo the to addresses
          let uriToAddr: ToAddrClass = new ToAddrClass(0);
          [target].forEach(tgt => {
            const to = new ToAddrClass(Utils.getNextToAddrID());

            to.to = tgt.address || '';
            to.amount = Utils.maxPrecisionTrimmed(tgt.amount || 0);
            to.memo = tgt.memoString || '';

            uriToAddr = to;
          });

          newState.toaddr = uriToAddr;

          setSendPageState(newState);
          return;
        } else {
          // Show the error message as a toast
          Toast.show(target);
          return;
        }
      } else {
        if (!toAddr) {
          return;
        }
        toAddr.to = address.replace(/[ \t\n\r]+/g, ''); // Remove spaces
      }
    }

    if (amount !== null) {
      toAddr.amount = amount.replace(decimalSeparator, '.').substring(0, 20);
      if (isNaN(Number(toAddr.amount))) {
        toAddr.amountUSD = '';
      } else if (toAddr.amount && info.zecPrice) {
        toAddr.amountUSD = Utils.toLocaleFloat((parseFloat(toAddr.amount) * info.zecPrice).toFixed(2));
      } else {
        toAddr.amountUSD = '';
      }
      toAddr.amount = toAddr.amount.replace('.', decimalSeparator);
    }

    if (amountUSD !== null) {
      toAddr.amountUSD = amountUSD.replace(decimalSeparator, '.').substring(0, 15);
      if (isNaN(Number(toAddr.amountUSD))) {
        toAddr.amount = '';
      } else if (toAddr.amountUSD && info.zecPrice) {
        toAddr.amount = Utils.toLocaleFloat(Utils.maxPrecisionTrimmed(parseFloat(amountUSD) / info.zecPrice));
      } else {
        toAddr.amount = '';
      }
      toAddr.amountUSD = toAddr.amountUSD.replace('.', decimalSeparator);
    }

    if (memo !== null) {
      toAddr.memo = memo;
    }

    newState.toaddr = newToAddr;
    setSendPageState(newState);
  };

  const confirmSend = async () => {
    // First, close the confirm modal and show the "computing" modal
    setConfirmModalVisible(false);
    setComputingModalVisible(true);

    const setLocalSendProgress = (progress: SendProgressClass) => {
      if (progress && progress.sendInProgress) {
        setSendProgress(progress);
      } else {
        setSendProgress(new SendProgressClass(0, 0, 0));
      }
    };

    // call the sendTransaction method in a timeout, allowing the modals to show properly
    setTimeout(async () => {
      try {
        const txid = await sendTransaction(setLocalSendProgress);
        setComputingModalVisible(false);

        // Clear the fields
        clearToAddr();

        if (navigation) {
          navigation.navigate(translate('loadedapp.wallet-menu'));
          setTimeout(() => {
            Toast.show(`${translate('send.Broadcast')} ${txid}`, Toast.LONG);
          }, 1000);
        }
      } catch (err) {
        setTimeout(() => {
          //console.log('sendtx error', err);
          Alert.alert(
            translate('send.sending-error'),
            `${err}`,
            [{ text: 'OK', onPress: () => setComputingModalVisible(false) }],
            {
              cancelable: false,
            },
          );
        }, 1000);
      }
    });
  };

  //console.log('render send', 'w', dimensions.width, 'h', dimensions.height);

  const returnPortrait = (
    <View
      accessible={true}
      accessibilityLabel={translate('send.title-acc')}
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        width: '100%',
        height: '100%',
        marginBottom: 200,
      }}>
      <Modal
        animationType="slide"
        transparent={false}
        visible={qrcodeModalVisble}
        onRequestClose={() => setQrcodeModalVisible(false)}>
        <Scanner
          updateToField={updateToField}
          closeModal={() => setQrcodeModalVisible(false)}
          width={dimensions.width - 42}
          height={dimensions.height * 0.7}
        />
      </Modal>

      <Modal
        animationType="slide"
        transparent={false}
        visible={confirmModalVisible}
        onRequestClose={() => setConfirmModalVisible(false)}>
        <Confirm
          defaultFee={defaultFee}
          closeModal={() => {
            setConfirmModalVisible(false);
          }}
          confirmSend={confirmSend}
        />
      </Modal>

      <Animated.View style={{ marginTop: slideAnim }}>
        <View
          onLayout={e => {
            const { height } = e.nativeEvent.layout;
            setTitleViewHeight(height);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingBottom: 0,
            backgroundColor: colors.card,
            zIndex: -1,
          }}>
          <View
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingBottom: 0,
              backgroundColor: colors.card,
              zIndex: -1,
              paddingTop: 10,
            }}>
            <Image
              source={require('../../assets/img/logobig-zingo.png')}
              style={{ width: 80, height: 80, resizeMode: 'contain' }}
            />
            <View style={{ flexDirection: 'row' }}>
              <ZecAmount
                currencyName={info.currencyName ? info.currencyName : ''}
                size={36}
                amtZec={totalBalance.total}
              />
              {totalBalance.total > 0 && (totalBalance.privateBal > 0 || totalBalance.transparentBal > 0) && (
                <TouchableOpacity onPress={() => poolsMoreInfoOnClick()}>
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      margin: 0,
                      padding: 0,
                      marginLeft: 5,
                      minWidth: 48,
                      minHeight: 48,
                    }}>
                    <RegText color={colors.primary}>{translate('transactions.pools')}</RegText>
                    <FontAwesomeIcon icon={faInfo} size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
            <UsdAmount style={{ marginTop: 0, marginBottom: 5 }} price={info.zecPrice} amtZec={totalBalance.total} />

            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginVertical: syncStatusDisplayLine ? 0 : 5,
              }}>
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                <RegText color={colors.money} style={{ paddingHorizontal: 5 }}>
                  {syncStatusDisplayLine ? translate('send.title-syncing') : translate('send.title')}
                </RegText>
                {!!syncStatusDisplayLine && (
                  <FadeText style={{ margin: 0, padding: 0 }}>{syncStatusDisplayLine}</FadeText>
                )}
              </View>
              {!!syncStatusDisplayLine && (
                <TouchableOpacity onPress={() => syncingStatusMoreInfoOnClick()}>
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.card,
                      borderRadius: 10,
                      margin: 0,
                      padding: 0,
                      marginLeft: 5,
                      minWidth: 48,
                      minHeight: 48,
                    }}>
                    <RegText color={colors.primary}>{translate('send.more')}</RegText>
                    <FontAwesomeIcon icon={faInfo} size={14} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ backgroundColor: colors.card, padding: 10, position: 'absolute', marginTop: slideAnim }}>
        <TouchableOpacity accessible={true} accessibilityLabel={translate('menudrawer-acc')} onPress={toggleMenuDrawer}>
          <FontAwesomeIcon icon={faBars} size={48} color={colors.border} />
        </TouchableOpacity>
      </Animated.View>

      <View style={{ width: '100%', height: 1, backgroundColor: colors.primary }} />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{}}>
        <View style={{ marginBottom: 30 }}>
          {[sendPageState.toaddr].map((ta, i) => {
            return (
              <View key={i} style={{ display: 'flex', padding: 10, marginTop: 10 }}>
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <RegText>{translate('send.toaddress')}</RegText>
                  {validAddress === 1 && <FontAwesomeIcon icon={faCheck} color={colors.primary} />}
                  {validAddress === -1 && <ErrorText>{translate('send.invalidaddress')}</ErrorText>}
                </View>
                <View
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderRadius: 5,
                    borderColor: colors.text,
                    marginTop: 5,
                  }}>
                  <View style={{ flexDirection: 'row' }}>
                    <View
                      accessible={true}
                      accessibilityLabel={translate('send.address-acc')}
                      style={{
                        flex: 1,
                        justifyContent: 'center',
                      }}>
                      <TextInput
                        placeholder={translate('send.addressplaceholder')}
                        placeholderTextColor={colors.placeholder}
                        style={{
                          color: colors.text,
                          fontWeight: '600',
                          fontSize: 16,
                          marginLeft: 5,
                        }}
                        value={ta.to}
                        onChangeText={(text: string) => updateToField(text, null, null, null)}
                        editable={true}
                      />
                    </View>
                    <View
                      style={{
                        width: 58,
                      }}>
                      <TouchableOpacity
                        accessible={true}
                        accessibilityLabel={translate('send.scan-acc')}
                        onPress={() => {
                          setQrcodeModalVisible(true);
                        }}>
                        <FontAwesomeIcon style={{ margin: 5 }} size={48} icon={faQrcode} color={colors.border} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 10, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <FadeText>{translate('send.amount')}</FadeText>
                  {validAmount === -1 && <ErrorText>{translate('send.invalidamount')}</ErrorText>}
                </View>

                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}>
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-start',
                      width: '60%',
                    }}>
                    <RegText style={{ marginTop: 20, marginRight: 5, fontSize: 20 }}>{'\u1647'}</RegText>
                    <View
                      accessible={true}
                      accessibilityLabel={translate('send.zec-acc')}
                      style={{
                        flexGrow: 1,
                        borderWidth: 1,
                        borderRadius: 5,
                        borderColor: colors.text,
                        marginTop: 5,
                        width: '75%',
                        minWidth: 48,
                        minHeight: 48,
                      }}>
                      <TextInput
                        placeholder={`#${decimalSeparator}########`}
                        placeholderTextColor={colors.placeholder}
                        keyboardType="numeric"
                        style={{
                          color: colors.text,
                          fontWeight: '600',
                          fontSize: 18,
                          minWidth: 48,
                          minHeight: 48,
                          marginLeft: 5,
                        }}
                        value={ta.amount.toString()}
                        onChangeText={(text: string) => updateToField(null, text.substring(0, 20), null, null)}
                        onEndEditing={(e: any) => updateToField(null, e.nativeEvent.text.substring(0, 20), null, null)}
                        editable={true}
                        maxLength={20}
                      />
                    </View>
                    <RegText style={{ marginTop: 15, marginRight: 10, marginLeft: 5 }}>ZEC</RegText>
                  </View>

                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-start',
                      width: '35%',
                    }}>
                    <RegText style={{ marginTop: 15, marginRight: 5 }}>$</RegText>
                    <View
                      accessible={true}
                      accessibilityLabel={translate('send.usd-acc')}
                      style={{
                        flexGrow: 1,
                        borderWidth: 1,
                        borderRadius: 5,
                        borderColor: colors.text,
                        marginTop: 5,
                        width: '55%',
                        minWidth: 48,
                        minHeight: 48,
                      }}>
                      <TextInput
                        placeholder={`#${decimalSeparator}##`}
                        placeholderTextColor={colors.placeholder}
                        keyboardType="numeric"
                        style={{
                          color: colors.text,
                          fontWeight: '600',
                          fontSize: 18,
                          minWidth: 48,
                          minHeight: 48,
                          marginLeft: 5,
                        }}
                        value={ta.amountUSD.toString()}
                        onChangeText={(text: string) => updateToField(null, null, text.substring(0, 15), null)}
                        onEndEditing={(e: any) => updateToField(null, null, e.nativeEvent.text.substring(0, 15), null)}
                        editable={true}
                        maxLength={15}
                      />
                    </View>
                    <RegText style={{ marginTop: 15, marginLeft: 5 }}>USD</RegText>
                  </View>
                </View>

                <View style={{ display: 'flex', flexDirection: 'column' }}>
                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      marginTop: 10,
                    }}>
                    <RegText>{translate('send.spendable')}</RegText>
                    <ZecAmount
                      currencyName={info.currencyName ? info.currencyName : ''}
                      color={stillConfirming ? 'red' : colors.money}
                      size={18}
                      amtZec={getMaxAmount()}
                    />
                  </View>
                  {stillConfirming && (
                    <TouchableOpacity onPress={() => poolsMoreInfoOnClick()}>
                      <View
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          marginTop: 5,
                          backgroundColor: colors.card,
                          padding: 5,
                          borderRadius: 10,
                        }}>
                        <FontAwesomeIcon icon={faInfo} size={14} color={colors.primary} />
                        <FadeText>{translate('send.somefunds')}</FadeText>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {memoEnabled === true && (
                  <>
                    <FadeText style={{ marginTop: 10 }}>{translate('send.memo')}</FadeText>
                    <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start' }}>
                      <View
                        accessible={true}
                        accessibilityLabel={translate('send.memo-acc')}
                        style={{
                          flexGrow: 1,
                          borderWidth: 1,
                          borderRadius: 5,
                          borderColor: colors.text,
                          minWidth: 48,
                          minHeight: 48,
                          maxHeight: 150,
                        }}>
                        <TextInput
                          multiline
                          style={{
                            color: colors.text,
                            fontWeight: '600',
                            fontSize: 18,
                            minWidth: 48,
                            minHeight: 48,
                            marginLeft: 5,
                          }}
                          value={ta.memo}
                          onChangeText={(text: string) => updateToField(null, null, null, text)}
                          editable={true}
                        />
                      </View>
                    </View>
                  </>
                )}
              </View>
            );
          })}
          <View
            style={{
              flexGrow: 1,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              marginVertical: 5,
            }}>
            <Button
              accessible={true}
              accessibilityLabel={'title ' + translate('send.button')}
              type="Primary"
              title={translate('send.button')}
              disabled={!sendButtonEnabled}
              onPress={() => setConfirmModalVisible(true)}
            />
            <Button
              type="Secondary"
              style={{ marginLeft: 10 }}
              title={translate('send.clear')}
              onPress={() => clearToAddr()}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const returnLandscape = (
    <View style={{ flexDirection: 'row', height: '100%' }}>
      <View
        accessible={true}
        accessibilityLabel={translate('send.title-acc')}
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          width: dimensions.width / 2,
        }}>
        <Modal
          animationType="slide"
          transparent={false}
          visible={qrcodeModalVisble}
          onRequestClose={() => setQrcodeModalVisible(false)}>
          <Scanner
            updateToField={updateToField}
            closeModal={() => setQrcodeModalVisible(false)}
            width={dimensions.width / 2}
            height={dimensions.height * 0.7}
          />
        </Modal>

        <Modal
          animationType="slide"
          transparent={false}
          visible={confirmModalVisible}
          onRequestClose={() => setConfirmModalVisible(false)}>
          <Confirm
            defaultFee={defaultFee}
            closeModal={() => {
              setConfirmModalVisible(false);
            }}
            confirmSend={confirmSend}
          />
        </Modal>

        <View style={{}}>
          <View
            onLayout={e => {
              const { height } = e.nativeEvent.layout;
              setTitleViewHeight(height);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: colors.card,
              zIndex: -1,
            }}>
            <View
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: colors.card,
                zIndex: -1,
                padding: 10,
                width: '100%',
              }}>
              <Image
                source={require('../../assets/img/logobig-zingo.png')}
                style={{ width: 80, height: 80, resizeMode: 'contain' }}
              />
              <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                {totalBalance.total > 0 && (totalBalance.privateBal > 0 || totalBalance.transparentBal > 0) && (
                  <TouchableOpacity onPress={() => poolsMoreInfoOnClick()}>
                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        backgroundColor: colors.card,
                        borderRadius: 10,
                        margin: 0,
                        padding: 0,
                        minWidth: 48,
                        minHeight: 48,
                      }}>
                      <RegText color={colors.primary}>{translate('transactions.pools')}</RegText>
                      <FontAwesomeIcon icon={faInfo} size={14} color={colors.primary} style={{ marginBottom: 5 }} />
                    </View>
                  </TouchableOpacity>
                )}
                <ZecAmount
                  currencyName={info.currencyName ? info.currencyName : ''}
                  size={36}
                  amtZec={totalBalance.total}
                />
                <UsdAmount
                  style={{ marginTop: 0, marginBottom: 5 }}
                  price={info.zecPrice}
                  amtZec={totalBalance.total}
                />
              </View>

              <View style={{ width: '100%', height: 1, backgroundColor: colors.primary, marginTop: 5 }} />

              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  marginVertical: syncStatusDisplayLine ? 0 : 5,
                }}>
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                  }}>
                  <RegText color={colors.money} style={{ paddingHorizontal: 5 }}>
                    {syncStatusDisplayLine ? translate('send.title-syncing') : translate('send.title')}
                  </RegText>
                  {!!syncStatusDisplayLine && (
                    <FadeText style={{ margin: 0, padding: 0 }}>{syncStatusDisplayLine}</FadeText>
                  )}
                </View>
                {!!syncStatusDisplayLine && (
                  <TouchableOpacity onPress={() => syncingStatusMoreInfoOnClick()}>
                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.card,
                        borderRadius: 10,
                        margin: 0,
                        padding: 0,
                        marginLeft: 5,
                        minWidth: 48,
                        minHeight: 48,
                      }}>
                      <RegText color={colors.primary}>{translate('send.more')}</RegText>
                      <FontAwesomeIcon icon={faInfo} size={14} color={colors.primary} />
                    </View>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ width: '100%', height: 1, backgroundColor: colors.primary }} />
            </View>
          </View>
        </View>

        <View style={{ backgroundColor: colors.card, padding: 10, position: 'absolute' }}>
          <TouchableOpacity
            accessible={true}
            accessibilityLabel={translate('menudrawer-acc')}
            onPress={toggleMenuDrawer}>
            <FontAwesomeIcon icon={faBars} size={48} color={colors.border} />
          </TouchableOpacity>
        </View>
      </View>
      <View
        style={{
          borderLeftColor: colors.border,
          borderLeftWidth: 1,
          alignItems: 'center',
          padding: 0,
          height: '100%',
          width: dimensions.width / 2,
        }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{}} style={{}}>
          <View style={{ marginBottom: 150 }}>
            {[sendPageState.toaddr].map((ta, i) => {
              return (
                <View key={i} style={{ display: 'flex', padding: 5, marginTop: 10 }}>
                  <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <RegText>{translate('send.toaddress')}</RegText>
                    {validAddress === 1 && <FontAwesomeIcon icon={faCheck} color={colors.primary} />}
                    {validAddress === -1 && <ErrorText>{translate('send.invalidaddress')}</ErrorText>}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderRadius: 5,
                      borderColor: colors.text,
                      marginTop: 5,
                    }}>
                    <View style={{ flexDirection: 'row' }}>
                      <View
                        accessible={true}
                        accessibilityLabel={translate('send.address-acc')}
                        style={{
                          flex: 1,
                          justifyContent: 'center',
                        }}>
                        <TextInput
                          placeholder={translate('send.addressplaceholder')}
                          placeholderTextColor={colors.placeholder}
                          style={{
                            color: colors.text,
                            fontWeight: '600',
                            fontSize: 16,
                            marginLeft: 5,
                          }}
                          value={ta.to}
                          onChangeText={(text: string) => updateToField(text, null, null, null)}
                          editable={true}
                        />
                      </View>
                      <View
                        style={{
                          width: 58,
                        }}>
                        <TouchableOpacity
                          accessible={true}
                          accessibilityLabel={translate('send.scan-acc')}
                          onPress={() => {
                            setQrcodeModalVisible(true);
                          }}>
                          <FontAwesomeIcon style={{ margin: 5 }} size={48} icon={faQrcode} color={colors.border} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{ marginTop: 10, display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                    <FadeText>{translate('send.amount')}</FadeText>
                    {validAmount === -1 && <ErrorText>{translate('send.invalidamount')}</ErrorText>}
                  </View>

                  <View
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}>
                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        width: '60%',
                      }}>
                      <RegText style={{ marginTop: 20, marginRight: 5, fontSize: 20 }}>{'\u1647'}</RegText>
                      <View
                        accessible={true}
                        accessibilityLabel={translate('send.zec-acc')}
                        style={{
                          flexGrow: 1,
                          borderWidth: 1,
                          borderRadius: 5,
                          borderColor: colors.text,
                          marginTop: 5,
                          width: '75%',
                          minWidth: 48,
                          minHeight: 48,
                        }}>
                        <TextInput
                          placeholder={`#${decimalSeparator}########`}
                          placeholderTextColor={colors.placeholder}
                          keyboardType="numeric"
                          style={{
                            color: colors.text,
                            fontWeight: '600',
                            fontSize: 18,
                            minWidth: 48,
                            minHeight: 48,
                            marginLeft: 5,
                          }}
                          value={ta.amount.toString()}
                          onChangeText={(text: string) => updateToField(null, text.substring(0, 20), null, null)}
                          onEndEditing={(e: any) =>
                            updateToField(null, e.nativeEvent.text.substring(0, 20), null, null)
                          }
                          editable={true}
                          maxLength={20}
                        />
                      </View>
                      <RegText style={{ marginTop: 15, marginRight: 10, marginLeft: 5 }}>ZEC</RegText>
                    </View>

                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        width: '35%',
                      }}>
                      <RegText style={{ marginTop: 15, marginRight: 5 }}>$</RegText>
                      <View
                        accessible={true}
                        accessibilityLabel={translate('send.usd-acc')}
                        style={{
                          flexGrow: 1,
                          borderWidth: 1,
                          borderRadius: 5,
                          borderColor: colors.text,
                          marginTop: 5,
                          width: '55%',
                          minWidth: 48,
                          minHeight: 48,
                        }}>
                        <TextInput
                          placeholder={`#${decimalSeparator}##`}
                          placeholderTextColor={colors.placeholder}
                          keyboardType="numeric"
                          style={{
                            color: colors.text,
                            fontWeight: '600',
                            fontSize: 18,
                            minWidth: 48,
                            minHeight: 48,
                            marginLeft: 5,
                          }}
                          value={ta.amountUSD.toString()}
                          onChangeText={(text: string) => updateToField(null, null, text.substring(0, 15), null)}
                          onEndEditing={(e: any) =>
                            updateToField(null, null, e.nativeEvent.text.substring(0, 15), null)
                          }
                          editable={true}
                          maxLength={15}
                        />
                      </View>
                      <RegText style={{ marginTop: 15, marginLeft: 5 }}>USD</RegText>
                    </View>
                  </View>

                  <View style={{ display: 'flex', flexDirection: 'column' }}>
                    <View
                      style={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        marginTop: 10,
                      }}>
                      <RegText>{translate('send.spendable')}</RegText>
                      <ZecAmount
                        currencyName={info.currencyName ? info.currencyName : ''}
                        color={stillConfirming ? 'red' : colors.money}
                        size={18}
                        amtZec={getMaxAmount()}
                      />
                    </View>
                    {stillConfirming && (
                      <View
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          marginTop: 5,
                          backgroundColor: colors.card,
                          padding: 5,
                          borderRadius: 10,
                        }}>
                        <FontAwesomeIcon icon={faInfo} size={14} color={colors.primary} />
                        <FadeText>{translate('send.somefunds')}</FadeText>
                      </View>
                    )}
                  </View>

                  {memoEnabled === true && (
                    <>
                      <FadeText style={{ marginTop: 10 }}>{translate('send.memo')}</FadeText>
                      <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start' }}>
                        <View
                          accessible={true}
                          accessibilityLabel={translate('send.memo-acc')}
                          style={{
                            flexGrow: 1,
                            borderWidth: 1,
                            borderRadius: 5,
                            borderColor: colors.text,
                            minWidth: 48,
                            minHeight: 48,
                            maxHeight: 150,
                          }}>
                          <TextInput
                            multiline
                            style={{
                              color: colors.text,
                              fontWeight: '600',
                              fontSize: 18,
                              minWidth: 48,
                              minHeight: 48,
                              marginLeft: 5,
                            }}
                            value={ta.memo}
                            onChangeText={(text: string) => updateToField(null, null, null, text)}
                            editable={true}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </View>
              );
            })}
            <View
              style={{
                flexGrow: 1,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                marginVertical: 5,
              }}>
              <Button
                accessible={true}
                accessibilityLabel={'title ' + translate('send.button')}
                type="Primary"
                title={translate('send.button')}
                disabled={!sendButtonEnabled}
                onPress={() => setConfirmModalVisible(true)}
              />
              <Button
                type="Secondary"
                style={{ marginLeft: 10 }}
                title={translate('send.clear')}
                onPress={() => clearToAddr()}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  //console.log(dimensions);

  if (dimensions.orientation === 'landscape') {
    return returnLandscape;
  } else {
    return returnPortrait;
  }
};

export default Send;