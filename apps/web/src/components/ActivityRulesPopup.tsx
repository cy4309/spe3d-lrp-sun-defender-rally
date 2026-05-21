import ModalOverlay from "@/components/ModalOverlay";
import SlantedBorder from "@/components/SlantedBorder";

const LRP_ARTICLE_URL =
  "https://www.lrp.com.tw/Expert/ExpertNews/ArticleIndex?intAnswerCode=652&intPattern=0&utm_source=Line&utm_medium=crmmsg&utm_campaign=2026crmuv&utm_content=2026crmuv";

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-1.5 text-[11px] leading-relaxed text-gray-700">
      <span className="shrink-0">🔆</span>
      <span>{children}</span>
    </p>
  );
}

function DotItem({ children }: { children: React.ReactNode }) {
  return <li className="ml-4 list-disc text-[11px] leading-relaxed text-gray-700">{children}</li>;
}

export default function ActivityRulesPopup({ onClose }: { onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex max-h-[min(80vh,560px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h2 className="mb-1 text-center text-xl font-black text-brand-blue">活動辦法</h2>
          <SlantedBorder className="mb-4" />

          <div className="space-y-4 text-left">
            <p className="text-center text-[12px] font-bold leading-snug text-gray-800">
              🌞 活動時間 2026/7/3(五) – 2026/8/23(日) 🌞
            </p>
            <p className="text-[11px] leading-relaxed text-gray-700">
              📣 活動期間參加「理膚防曬應援 今夏不怕曬」活動並完成體驗，可至活動指定地點設置的派樣機台免費領取「夏日防曬組」。分享此活動給 LINE 好友邀請體驗，即可獲得「理膚寶水防曬產品」抽獎資格！（共抽 3 名）
            </p>

            <h3 className="text-center text-sm font-black tracking-[0.2em] text-brand-blue">活 動 說 明</h3>

            <div className="space-y-2.5">
              <Bullet>
                本活動僅限於活動時間內加入理膚寶水 LINE 官方帳號好友，並參加「理膚防曬應援 今夏不怕曬」完成專屬應援人物製作體驗，即可獲得「夏日防曬組」QR Code 兌換碼一枚。參加活動者可持 QR Code 兌換碼前往活動指定地點所設置的派樣機台免費領取試用組。
              </Bullet>
              <Bullet>
                請留意活動系統所提供之兌換碼為一次性 QR Code，於機台掃描兌換完成後即失效。如因故遺失、損壞造成無法兌換，恕不另行補發。
              </Bullet>
              <Bullet>
                參加活動者於活動期間內分享此活動給 LINE 好友邀請體驗，好友完成體驗後方符合「理膚寶水防曬產品」抽獎資格，每人僅限乙次抽獎與獲獎機會。
              </Bullet>
              <Bullet>本活動「夏日防曬組」提供兌換之派樣機設置地點與設置期間如下：</Bullet>
              <ul className="space-y-2 pl-1">
                <DotItem>
                  <span className="font-semibold">台北市立天母棒球場｜賽事限定</span>
                  （*需自行購票入場）
                  <br />
                  活動日期：7/3(五)、7/4(六)、7/5(日)
                  <br />
                  派樣機地點：2 樓用餐休息區（三壘側 H 區）
                </DotItem>
                <DotItem>
                  <span className="font-semibold">台中漢神洲際購物廣場</span>
                  （*購物中心營業時間以漢神洲際官方公佈資訊為準）
                  <br />
                  活動日期：7/6(一)～8/2(日)
                  <br />
                  派樣機地點：4 樓運動用品區
                </DotItem>
                <DotItem>
                  <span className="font-semibold">高雄澄清湖棒球場｜賽事限定</span>
                  （*需自行購票入場）
                  <br />
                  活動日期：8/5(三)、8/7(五)、8/8(六)、8/9(日)、8/11(二)、8/12(三)、8/21(五)、8/22(六)、8/23(日)
                  <br />
                  派樣機地點：三壘側品牌活動區
                </DotItem>
              </ul>
              <Bullet>
                符合本活動「理膚寶水防曬產品」抽獎資格者，將統一於活動結束後 2026/8 月底前抽出三位贈獎名額，同步於官網最新消息公布得獎資訊，並以簡訊通知得獎者，後續將由品牌客服專員連繫得獎人確認收件資訊，並於連繫後 7 個工作天內寄出獎項。
              </Bullet>
              <Bullet>
                提醒！若 2026/8/15 前無法聯繫或期間也未接獲得獎人進線客服中心提供收件資訊者，逾期視同放棄、恕無法保留獲獎資格！2026/8/18 將由候補名單遞延得獎資格，不得異議。
              </Bullet>
              <Bullet>
                活動抽獎贈品：「理膚寶水防曬產品」不得要求折換現金、更換其他等值商品，亦不得轉售／轉讓／要求退貨。
              </Bullet>
              <Bullet>理膚寶水保有活動修改、解釋與終止權益。</Bullet>
            </div>

            <h3 className="pt-1 text-sm font-black text-brand-blue">活動注意事項</h3>
            <ul className="space-y-2 pl-1">
              <DotItem>
                參加活動者請先詳細閱讀活動內容及本注意事項以維護自身權益。參加者於參加本活動並提供資料之同時，即視為已同意接受本活動之活動辦法及注意事項。
              </DotItem>
              <DotItem>
                本活動的參與並無年齡限制，但透過抽獎方式贏得的獎品僅可由年滿 20 歲或以上的人士代理領取。如果未滿 20 歲，則必須由參與活動者的父母或合法監護人代為領取獎品。
              </DotItem>
              <DotItem>
                依中華民國稅法規定，等值獎金金額超過新臺幣 20,000 元（含）以上者，中獎者須先負擔 10% 中獎稅額；全年等值獎金金額超過新臺幣 1,000 元（含）以上，將納入年度個人所得計算，並於次年度寄發所得稅扣繳憑單。中獎人非中華民國境內之居住者（在台居住未滿 183 天）則須按獎項價值扣繳 20％機會中獎稅並提供居留證影本。
              </DotItem>
              <DotItem>
                本活動之參加者同意提供個人資料予主辦單位，並同意主辦單位得為本活動公告及網頁製作、消費行為分析、客戶管理、市場調查、產品開發或行銷等目的自行或委託第三人蒐集、處理與利用參加者所提供之資料，其處理與利用方式得包括但不限於用以寄發廣告傳單、DM 或廣告簡訊或郵件，且得以電磁記錄或其他方式儲存、編輯、傳輸、建檔，並不限定利用之期間與地區。參加者有權向主辦單位請求查詢、閱覽、製給所提供個人資料之影本（但主辦單位得收取必要之費用），亦得請求主辦單位補充或更正、停止蒐集、處理或利用、及刪除個人資料。參加者知悉得自由選擇是否提供個人資料，惟如未提供資料或資料不全，將可能導致主辦單位無法提供本活動之權益。
              </DotItem>
              <DotItem>
                為維護參加者權益，於活動期間內符合參加資格之 LINE 會員帳號所對應之個人資料，僅限領取本活動所提供之「夏日防曬組」乙次，以及「分享活動獲得抽獎資格」僅限乙次。若有偽造、變造者，或以連續 Email 群組信箱產生器或身分證字號產生器等電腦程式所產出之電子郵件帳號或個人資料參加本活動者，則主辦單位得逕行取消活動資格，並得追回不當取得獎項或請求損害賠償。
              </DotItem>
              <DotItem>
                主辦單位就參與本活動參加者之資格，保有審查之權利，若經查核有不符本活動規定之參加資格者，主辦單位將取消其參加或得獎之資格。
              </DotItem>
              <DotItem>本活動僅限設籍於台灣、金門、澎湖、馬祖者參加。主辦單位不提供寄送獎品至海外地區之服務。</DotItem>
              <DotItem>
                如有因任何電腦、網路、電話、技術或不可歸咎於主辦單位之事由，寄送之獎品有延遲、遺失、錯誤、無法辨識或毀損之情況，主辦單位不負任何法律責任，得獎者不得因此異議。
              </DotItem>
              <DotItem>主辦單位依法對本活動非本公司所進口、銷售之獎品不負後續品質保證或保固服務之責。</DotItem>
              <DotItem>
                活動注意事項未盡之事宜，依中獎通知函說明為準，中獎者不得要求更改獎項、兌換現金、折讓或任何調整事項。
              </DotItem>
              <DotItem>
                若原定獎項因故無法提供，主辦單位得另以等值之獎品替代之，得獎者不得異議，不得要求折換現金、更換其他等值商品或要求提供任何補償。
              </DotItem>
              <DotItem>本活動因故無法進行時，主辦單位有權決定取消、終止、修改或暫停本活動。</DotItem>
              <DotItem>
                主辦單位保有隨時修改及終止本活動之權利，如有任何變更內容或詳細注意事項將公佈於本活動網站，恕不另行通知。
              </DotItem>
              <DotItem>如對本活動辦法、注意事項及活動獎項有任何疑問，請來電客服：0800-257-889。</DotItem>
            </ul>

            <p className="text-[11px] leading-relaxed text-gray-600">
              理膚活動說明頁案例：
              <br />
              <a
                href={LRP_ARTICLE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand-blue underline"
              >
                {LRP_ARTICLE_URL}
              </a>
            </p>
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-5 py-4">
          <button type="button" className="btn btn-primary btn-block py-3 text-sm" onClick={onClose}>
            確認
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
